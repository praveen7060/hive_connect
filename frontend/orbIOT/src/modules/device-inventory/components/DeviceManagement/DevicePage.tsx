import { useMemo, useState } from "react";
import {
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Plus,
} from "lucide-react";
import DeviceForm from "./DeviceForm";
import DeviceDetailsView from "./DeviceDetailsView";
import { deviceInventoryApi, type IotProvisionResponse } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type DeviceRow = {
  id: string | number;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

interface FilterConfig {
  key: string;
  label: string;
  options: string[];
}

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: PrimitiveValue | undefined, row: DeviceRow) => string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

interface BadgeProps {
  value: string;
  variant?: "status" | "connection" | "default";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS: FilterConfig[] = [
  { key: "connectionType", label: "Type", options: ["MQTT", "HTTP", "CoAP"] },
  { key: "status", label: "Status", options: ["provisioning", "active", "inactive"] },
];

const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name" },
  { key: "serialNumber", label: "Serial Number" },
  { key: "connectionType", label: "Connection Type" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const INITIAL_ROWS: DeviceRow[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: PrimitiveValue | undefined): string {
  if (val === undefined || val === null || String(val).trim() === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (String(val).match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(String(val)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return String(val);
}

function generateProvisioningUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(16).slice(2, 10);
  return `device-${Date.now().toString(16)}-${randomPart}`;
}

function sanitizeAwsIotAttributeValue(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.,@/:#=\[\]-]/g, "_")
    .slice(0, 800);
}

function buildMergedMetadata(
  existingMetadata: PrimitiveValue | undefined,
  provisioningData: IotProvisionResponse,
  thingId: string
): string {
  const raw = String(existingMetadata ?? "").trim();
  let base: Record<string, unknown> = {};

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      } else {
        base = { rawMetadata: raw };
      }
    } catch {
      base = { rawMetadata: raw };
    }
  }

  const provisioning = provisioningData.provisioning;
  const bucket = provisioning?.bucket ?? "";
  const s3Keys = provisioning?.s3Keys;

  const documents =
    bucket && s3Keys
      ? {
          certificate: `s3://${bucket}/${s3Keys.certificate}`,
          privateKey: `s3://${bucket}/${s3Keys.privateKey}`,
          publicKey: `s3://${bucket}/${s3Keys.publicKey}`,
          metadata: `s3://${bucket}/${s3Keys.metadata}`,
        }
      : undefined;

  base.iot = {
    thingId,
    thingName: provisioning?.thingName ?? thingId,
    certificateId: provisioning?.certificateId ?? null,
    certificateArn: provisioning?.certificateArn ?? null,
    region: provisioning?.region ?? null,
    bucket: provisioning?.bucket ?? null,
    policyAttached: provisioning?.policyAttached ?? null,
    s3Keys: provisioning?.s3Keys ?? null,
    documents: documents ?? null,
    updatedAt: new Date().toISOString(),
  };

  return JSON.stringify(base, null, 2);
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const CONNECTION_COLORS: Record<string, string> = {
  MQTT: "bg-violet-50 text-violet-700 border-violet-200",
  HTTP: "bg-sky-50 text-sky-700 border-sky-200",
  CoAP: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  provisioning: "bg-blue-50 text-blue-700 border-blue-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

function Badge({ value, variant = "default" }: BadgeProps) {
  let cls = "bg-gray-100 text-gray-600 border-gray-200";
  if (variant === "connection") cls = CONNECTION_COLORS[value] ?? cls;
  if (variant === "status") cls = STATUS_COLORS[value] ?? cls;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      {value}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="inventory-kpi-card rounded-2xl px-6 py-5 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p
        className="inventory-kpi-value text-[38px] leading-none mt-1"
      >
        {value}
      </p>
      <p className="text-[12px] text-slate-500 mt-1.5">{sub}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeviceManagementPage() {
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filters, setFilters] = useState<Record<string, string>>(
    FILTERS.reduce<Record<string, string>>((acc, f) => {
      acc[f.key] = "all";
      return acc;
    }, {})
  );
  const [formValues, setFormValues] = useState<Record<string, PrimitiveValue>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    DeviceRow,
    Partial<DeviceRow>,
    Partial<DeviceRow>
  >(deviceInventoryApi.devices, { initialRows: INITIAL_ROWS });

  const filteredRows = useMemo<DeviceRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const searchPass =
        !q ||
        ["name", "serialNumber", "connectionType", "status"].some((k) =>
          String(row[k] ?? "").toLowerCase().includes(q)
        );
      const filterPass = FILTERS.every((f) => {
        const fv = filters[f.key];
        return !fv || fv === "all" || String(row[f.key] ?? "") === fv;
      });
      return searchPass && filterPass;
    });
  }, [filters, rows, searchTerm]);

  const provisioningCount = rows.filter((r) => r.status === "provisioning").length;
  const activeCount = rows.filter((r) => r.status === "active").length;
  const mqttCount = rows.filter((r) => r.connectionType === "MQTT").length;
  const selectedDevice = useMemo(
    () => rows.find((row) => row.id === selectedDeviceId) ?? null,
    [rows, selectedDeviceId]
  );

  const openCreate = (): void => {
    setEditingId(null);
    setSelectedDeviceId(null);
    setFormValues({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (row: DeviceRow): void => {
    setSelectedDeviceId(null);
    setFormValues(row);
    setEditingId(row.id);
    setSubmitError(null);
    setFormOpen(true);
  };

  const openDetails = (row: DeviceRow): void => {
    setEditingId(null);
    setFormOpen(false);
    setDeleteConfirm(null);
    setSelectedDeviceId(row.id);
  };

  const handleDelete = async (id: string | number): Promise<void> => {
    try {
      await deleteOne(id);
    } catch {
      return;
    }
    setDeleteConfirm(null);
  };

  const saveDevice = async (): Promise<boolean> => {
    const name = String(formValues.name ?? "").trim();
    const serialNumber = String(formValues.serialNumber ?? "").trim();
    const connectionType = String(formValues.connectionType ?? "").trim();
    const project = String(formValues.project ?? "").trim();
    if (!name || !serialNumber || !connectionType || !project) {
      return false;
    }

    setSubmitError(null);
    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      if (editingId !== null) {
        await updateOne(editingId, { ...formValues, updatedAt: now });
      } else {
        const thingName = generateProvisioningUuid();
        const provisioningData = await deviceInventoryApi.iot.provisionThing({
          deviceId: thingName,
          deviceType: "SINGLE",
          thingName,
          attributes: {
            displayName: sanitizeAwsIotAttributeValue(name),
            project: sanitizeAwsIotAttributeValue(project),
            connectionType: sanitizeAwsIotAttributeValue(connectionType),
          },
        });

        const thingId =
          provisioningData.device?.thingId ??
          provisioningData.provisioning?.thingName ??
          thingName;

        const created = await createOne({
          ...formValues,
          foreignId: thingId,
          status: "active",
          metadata: buildMergedMetadata(formValues.metadata, provisioningData, thingId),
          createdAt: now,
          updatedAt: now,
        });

        setSelectedDeviceId(created.id);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save device");
      setIsSaving(false);
      return false;
    }

    setIsSaving(false);
    setEditingId(null);
    setFormValues({});
    setFormOpen(false);
    return true;
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void saveDevice();
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues({});
    setFormOpen(false);
  };

  const resetFilters = (): void => {
    setSearchTerm("");
    setFilters(
      FILTERS.reduce<Record<string, string>>((acc, f) => {
        acc[f.key] = "all";
        return acc;
      }, {})
    );
  };

  const handleValueChange = (key: string, value: PrimitiveValue): void => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters: boolean =
    !!searchTerm || FILTERS.some((f) => filters[f.key] !== "all");

  const resolveCell = (col: ColumnConfig, row: DeviceRow) => {
    const display = col.format ? col.format(row[col.key], row) : fmt(row[col.key]);
    if (col.key === "connectionType") return <Badge value={display} variant="connection" />;
    if (col.key === "status") return <Badge value={display} variant="status" />;
    return (
      <span
        className={`text-[13px] ${
          col.key === "name"
            ? "font-bold text-slate-900"
            : col.key === "serialNumber"
            ? "font-mono text-slate-600 text-[12px]"
            : "font-normal text-slate-500"
        }`}
      >
        {display}
      </span>
    );
  };

  return (
    <div
      className="inventory-page-theme min-h-screen w-full"
    >
      <style>{`
        @keyframes slideInPanel {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .slide-in-panel {
          animation: slideInPanel 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .form-scroll {
          max-height: calc(100vh - 200px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .form-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .form-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .form-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 8px;
          border: 2px solid #f1f5f9;
        }
      `}</style>

      {/* Top bar */}
      <div className="flex items-start justify-between px-12 pt-12 pb-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Device Inventory
          </p>
          <h1
            className="text-[44px] text-slate-900"
            style={{ fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}
          >
            Device Management
          </h1>
          <p className="mt-2.5 text-[14px] text-slate-500">
            Create device records and assign connection details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (selectedDevice) {
              setSelectedDeviceId(null);
              return;
            }
            if (formOpen) {
              handleCancel();
              return;
            }
            openCreate();
          }}
          className={`mt-1 flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold shadow-md transition-all active:scale-95 ${
            selectedDevice || formOpen
              ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              : "bg-slate-900 text-white hover:bg-slate-700 hover:shadow-lg"
          }`}
        >
          {selectedDevice ? (
            <><X size={14} strokeWidth={2.5} />Back To List</>
          ) : formOpen ? (
            <><X size={14} strokeWidth={2.5} />Close</>
          ) : (
            <><Plus size={15} strokeWidth={2.5} />Add Device</>
          )}
        </button>
      </div>

      {selectedDevice ? (
        <div className="px-12 mt-8 pb-14">
          <DeviceDetailsView
            device={selectedDevice}
            onBack={() => setSelectedDeviceId(null)}
            onEdit={() => openEdit(selectedDevice)}
          />
        </div>
      ) : (
      <>
      {/* Stat Cards */}
      <div className="px-12 mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Devices" value={String(rows.length)} sub="all registered devices" />
        <StatCard label="Provisioning" value={String(provisioningCount)} sub="awaiting activation" />
        <StatCard label="Active" value={String(activeCount)} sub="currently online" />
        <StatCard label="MQTT" value={String(mqttCount)} sub="using MQTT protocol" />
      </div>
      {error && (
        <div className="px-12 mt-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        </div>
      )}
      {submitError && (
        <div className="px-12 mt-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {submitError}
          </p>
        </div>
      )}
      {loading && (
        <div className="px-12 mt-4">
          <p className="text-[12px] text-slate-500">Loading devices...</p>
        </div>
      )}

      {/* Main split layout */}
      <div className="px-12 mt-8 pb-14 flex gap-6 items-start">

        {/* Table column */}
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search devices…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>

            {FILTERS.map((f) => (
              <div key={f.key} className="relative">
                <select
                  value={filters[f.key]}
                  onChange={(e) => setFilters((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer"
                >
                  <option value="all">{f.label}</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            ))}

            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 h-11 text-[13px] text-slate-500 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors">
                <RotateCcw size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="whitespace-nowrap px-6 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <Search size={18} className="text-slate-400" />
                          </div>
                          <p className="text-[13px] font-semibold text-slate-500">No devices found</p>
                          <p className="text-[12px] text-slate-400">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => openDetails(row)}
                        className={`cursor-pointer border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70 ${editingId === row.id ? "bg-blue-50/30" : ""}`}
                      >
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="whitespace-nowrap px-6 py-4">
                            {resolveCell(col, row)}
                          </td>
                        ))}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(row);
                              }}
                              className={`rounded-lg p-2 transition-colors ${editingId === row.id ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
                              aria-label="Edit device"
                            >
                              <Pencil size={13} strokeWidth={2.2} />
                            </button>
                            {deleteConfirm === row.id ? (
                              <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                                <span className="text-[11px] font-semibold text-red-600 mr-1">Delete?</span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDelete(row.id);
                                  }}
                                  className="text-[11px] font-bold text-red-600 hover:text-red-800 transition-colors"
                                >
                                  Yes
                                </button>
                                <span className="text-red-200 mx-0.5">/</span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteConfirm(null);
                                  }}
                                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteConfirm(row.id);
                                }}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                aria-label="Delete device"
                              >
                                <Trash2 size={13} strokeWidth={2.2} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-[11px] font-semibold text-slate-400">
              <span>{filteredRows.length} device{filteredRows.length !== 1 ? "s" : ""}</span>
              <span>{filteredRows.length === 0 ? "0 results" : `1–${filteredRows.length} of ${rows.length}`}</span>
            </div>
          </div>
        </div>

        {/* Side Form Panel */}
        {formOpen && (
          <div className="inventory-form-shell inventory-form-theme slide-in-panel shrink-0 sticky top-8">
            <div className="inventory-form-panel rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              {/* Form with separate scrolling */}
              <div className="form-scroll max-h-[calc(100vh-200px)]">
                <DeviceForm
                  formId="device-form"
                  formTitle={editingId ? "Edit Device" : "Create New Device"}
                  formSubtitle={editingId ? "Update the device details below." : "Enter the details for the new device"}
                  editing={!!editingId}
                  values={formValues}
                  onValueChange={handleValueChange}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  isSaving={isSaving}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}





