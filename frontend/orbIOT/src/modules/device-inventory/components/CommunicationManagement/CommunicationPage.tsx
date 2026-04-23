import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Plus,
} from "lucide-react";
import CommunicationForm from './CommunicationForm';
import { buildDevicePageUrl, getAdjacentDeviceQueryKey } from "../management/flow";
import { deviceInventoryApi } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type CommunicationRow = {
  id: string | number;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

type ItemTypeEntityRow = {
  id: string | number;
  name?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

interface FilterConfig {
  key: string;
  label: string;
  options: string[];
}

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: PrimitiveValue | undefined, row: CommunicationRow) => string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

interface BadgeProps {
  value: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS: FilterConfig[] = [
  { key: "protocol", label: "Protocol", options: ["MQTT", "HTTP", "CoAP"] },
  { key: "centric", label: "Centric", options: ["PAYLOAD", "TOPIC"] },
  { key: "messageFormat", label: "Message Format", options: ["JSON", "XML", "PROTOBUF"] },
];

const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name" },
  { key: "groupName", label: "Group Name" },
  { key: "protocol", label: "Protocol" },
  { key: "centric", label: "Centric" },
  { key: "messageFormat", label: "Message Format" },
  { key: "icon", label: "Icon" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const INITIAL_ROWS: CommunicationRow[] = [];

const BADGE_KEYS = new Set(["protocol", "centric", "messageFormat"]);

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

function buildDefaults(): Record<string, PrimitiveValue> {
  return {
    name: "",
    groupName: "",
    itemType: "",
    protocol: "",
    messageFormat: "",
    centric: "",
    messageStructure: "",
    confirmationMessageStructure: "",
    icon: "",
    needFirmware: false,
    needConfirmation: false,
    image: "",
  };
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  MQTT: "bg-violet-50 text-violet-700 border-violet-200",
  HTTP: "bg-sky-50 text-sky-700 border-sky-200",
  CoAP: "bg-amber-50 text-amber-700 border-amber-200",
  PAYLOAD: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TOPIC: "bg-blue-50 text-blue-700 border-blue-200",
  JSON: "bg-orange-50 text-orange-700 border-orange-200",
  XML: "bg-rose-50 text-rose-700 border-rose-200",
  PROTOBUF: "bg-slate-100 text-slate-600 border-slate-200",
};

function Badge({ value }: BadgeProps) {
  const cls = BADGE_COLORS[value] ?? "bg-gray-100 text-gray-600 border-gray-200";
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
export default function CommunicationManagementPage() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filters, setFilters] = useState<Record<string, string>>(
    FILTERS.reduce<Record<string, string>>((acc, f) => {
      acc[f.key] = "all";
      return acc;
    }, {})
  );
  const [formValues, setFormValues] = useState<Record<string, PrimitiveValue>>(buildDefaults());
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    CommunicationRow,
    Partial<CommunicationRow>,
    Partial<CommunicationRow>
  >(deviceInventoryApi.communications, { initialRows: INITIAL_ROWS });
  const { rows: itemTypeRows, loading: itemTypesLoading } = useCrudResource<
    ItemTypeEntityRow,
    Partial<ItemTypeEntityRow>,
    Partial<ItemTypeEntityRow>
  >(deviceInventoryApi.itemTypes, { initialRows: [] });

  const filteredRows = useMemo<CommunicationRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const searchPass =
        !q ||
        ["name", "groupName", "protocol", "centric", "messageFormat", "icon"].some((k) =>
          String(row[k] ?? "").toLowerCase().includes(q)
        );
      const filterPass = FILTERS.every((f) => {
        const fv = filters[f.key];
        return !fv || fv === "all" || String(row[f.key] ?? "") === fv;
      });
      return searchPass && filterPass;
    });
  }, [filters, rows, searchTerm]);

  const mqttCount = rows.filter((r) => r.protocol === "MQTT").length;
  const topicCount = rows.filter((r) => r.centric === "TOPIC").length;
  const itemTypeOptions = useMemo<string[]>(() => {
    const deduped = new Set<string>();

    itemTypeRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (name) deduped.add(name);
    });

    rows.forEach((row) => {
      const itemType = String(row.itemType ?? "").trim();
      if (itemType) deduped.add(itemType);
    });

    const selectedItemType = String(formValues.itemType ?? "").trim();
    if (selectedItemType) deduped.add(selectedItemType);

    return Array.from(deduped).sort((a, b) => a.localeCompare(b));
  }, [formValues.itemType, itemTypeRows, rows]);

  const openCreate = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(true);
  };

  const openEdit = (row: CommunicationRow): void => {
    setFormValues(
      Object.keys(buildDefaults()).reduce<Record<string, PrimitiveValue>>((acc, key) => {
        acc[key] = row[key] ?? (key === 'needFirmware' || key === 'needConfirmation' ? false : 
                  key === 'messageStructure' || key === 'confirmationMessageStructure' ? "" : "");
        return acc;
      }, {})
    );
    setEditingId(row.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: string | number): Promise<void> => {
    try {
      await deleteOne(id);
    } catch {
      return;
    }
    setDeleteConfirm(null);
  };

  const saveCommunicationPolicy = async (): Promise<boolean> => {
    const name = String(formValues.name ?? "").trim();
    const groupName = String(formValues.groupName ?? "").trim();
    const itemType = String(formValues.itemType ?? "").trim();
    const protocol = String(formValues.protocol ?? "").trim();
    const messageFormat = String(formValues.messageFormat ?? "").trim();
    const centric = String(formValues.centric ?? "").trim();
    const icon = String(formValues.icon ?? "").trim();
    if (!name || !groupName || !itemType || !protocol || !messageFormat || !centric || !icon) {
      return false;
    }

    const now = new Date().toISOString();
    
    // Build an explicit payload with serializable primitives only.
    const payload: Record<string, PrimitiveValue> = {
      name,
      groupName,
      itemType,
      protocol,
      messageFormat,
      centric,
      messageStructure: String(formValues.messageStructure ?? ""),
      confirmationMessageStructure: String(formValues.confirmationMessageStructure ?? ""),
      icon,
      needFirmware: Boolean(formValues.needFirmware),
      needConfirmation: Boolean(formValues.needConfirmation),
    };
    const image =
      typeof formValues.image === "string"
        ? formValues.image.trim()
        : formValues.image == null
          ? ""
          : String(formValues.image).trim();
    if (image) {
      payload.image = image;
    }

    try {
      if (editingId !== null) {
        await updateOne(editingId, { ...payload, updatedAt: now });
      } else {
        await createOne({ ...payload, createdAt: now, updatedAt: now });
      }
    } catch {
      return false;
    }

    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(false);
    return true;
  };

  const handleSubmit = (): void => {
    void saveCommunicationPolicy();
  };

  const goToPreviousPage = (): void => {
    const previousPage =
      getAdjacentDeviceQueryKey("communicationPage", "previous") ?? "communicationPage";
    navigate(buildDevicePageUrl(previousPage));
  };

  const handleSaveAndNext = async (): Promise<void> => {
    const saved = await saveCommunicationPolicy();
    if (!saved) return;

    const nextPage = getAdjacentDeviceQueryKey("communicationPage", "next");
    if (nextPage) {
      navigate(buildDevicePageUrl(nextPage));
    }
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(false);
    setDeleteConfirm(null);
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

  const hasActiveFilters: boolean =
    !!searchTerm || FILTERS.some((f) => filters[f.key] !== "all");

  const resolveCell = (col: ColumnConfig, row: CommunicationRow) => {
    const display = col.format ? col.format(row[col.key], row) : fmt(row[col.key]);
    if (BADGE_KEYS.has(col.key)) {
      return <Badge value={display} />;
    }
    return (
      <span
        className={`text-[13px] ${
          col.key === "name" ? "font-bold text-slate-900" : "font-normal text-slate-500"
        }`}
      >
        {display}
      </span>
    );
  };

  return (
    <div
      className="inventory-page-theme min-h-screen w-full overflow-y-auto"
    >
      <style>{`
        @keyframes slideInPanel {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .slide-in-panel {
          animation: slideInPanel 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Page scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>

      {/* Main content with padding for scrollbar */}
      <div className="px-12 py-8">
        {/* ── Top bar ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
              Device Configuration
            </p>
            <h1
              className="text-[44px] text-slate-900"
              style={{ fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}
            >
              Communication Policies
            </h1>
            <p className="mt-2.5 text-[14px] text-slate-500">
              Define protocol and payload strategy for device communication.
            </p>
          </div>

          <button
            type="button"
            onClick={formOpen ? handleCancel : openCreate}
            className={`mt-1 flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold shadow-md transition-all active:scale-95 ${
              formOpen
                ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                : "bg-slate-900 text-white hover:bg-slate-700 hover:shadow-lg"
            }`}
          >
            {formOpen ? (
              <>
                <X size={14} strokeWidth={2.5} />
                Close
              </>
            ) : (
              <>
                <Plus size={15} strokeWidth={2.5} />
                Add Policy
              </>
            )}
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Policy Overview"
            value={String(rows.length)}
            sub={`${rows.length} communication policies`}
          />
          <StatCard
            label="Messaging Policies"
            value={String(rows.length)}
            sub="total active policies"
          />
          <StatCard
            label="MQTT Policies"
            value={String(mqttCount)}
            sub="using MQTT protocol"
          />
          <StatCard
            label="Topic Centric"
            value={String(topicCount)}
            sub="topic-based routing"
          />
        </div>

        {error && (
          <div className="mt-4">
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
              {error}
            </p>
          </div>
        )}
        {loading && (
          <div className="mt-4">
            <p className="text-[12px] text-slate-500">Loading communication policies...</p>
          </div>
        )}
        {/* ── Main split layout ── */}
        <div className="mt-8 flex gap-6 items-start">
          {/* ── Table column ── */}
          <div className="flex-1 min-w-0">
            {/* Filter bar */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search policies…"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {FILTERS.map((f) => (
                <div key={f.key} className="relative">
                  <select
                    value={filters[f.key]}
                    onChange={(e) =>
                      setFilters((c) => ({ ...c, [f.key]: e.target.value }))
                    }
                    className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer"
                  >
                    <option value="all">{f.label}</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              ))}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 h-11 text-[13px] text-slate-500 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors"
                >
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
                        <th
                          key={col.key}
                          className="whitespace-nowrap px-6 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        Actions
                      </th>
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
                            <p className="text-[13px] font-semibold text-slate-500">No policies found</p>
                            <p className="text-[12px] text-slate-400">Try adjusting your filters</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70 ${
                            editingId === row.id ? "bg-blue-50/30" : ""
                          }`}
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
                                onClick={() => openEdit(row)}
                                className={`rounded-lg p-2 transition-colors ${
                                  editingId === row.id
                                    ? "bg-blue-100 text-blue-600"
                                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                }`}
                                aria-label="Edit policy"
                              >
                                <Pencil size={13} strokeWidth={2.2} />
                              </button>

                              {deleteConfirm === row.id ? (
                                <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                                  <span className="text-[11px] font-semibold text-red-600 mr-1">
                                    Delete?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row.id)}
                                    className="text-[11px] font-bold text-red-600 hover:text-red-800 transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <span className="text-red-200 mx-0.5">/</span>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirm(null)}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(row.id)}
                                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                  aria-label="Delete policy"
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
                <span>
                  {filteredRows.length} polic{filteredRows.length !== 1 ? "ies" : "y"}
                </span>
                <span>
                  {filteredRows.length === 0
                    ? "0 results"
                    : `1–${filteredRows.length} of ${rows.length}`}
                </span>
              </div>
            </div>
          </div>

          {/* ── Side Form Panel ── */}
          {formOpen && (
            <div className="inventory-form-shell inventory-form-theme slide-in-panel shrink-0 sticky top-8">
              <CommunicationForm
                formId="communication-policy-form"
                formTitle={editingId ? "Edit Policy" : "Create Communication Policy"}
                formSubtitle={editingId 
                  ? "Update the policy details below." 
                  : "Enter details in sequence before moving to the next step."}
                editing={!!editingId}
                values={formValues}
                itemTypeOptions={itemTypeOptions}
                itemTypesLoading={itemTypesLoading}
                onValueChange={(key, value) => 
                  setFormValues((prev) => ({ ...prev, [key]: value }))
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                onCancel={handleCancel}
                onBack={goToPreviousPage}
                onSaveAndNext={handleSaveAndNext}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




