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
import ParameterForm from "./ParameterForm";
import { buildDevicePageUrl, getAdjacentDeviceQueryKey } from "../management/flow";
import { RightDrawer } from "../management/ui";
import { deviceInventoryApi } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type ParameterRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

type VendorRow = {
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
  format?: (value: PrimitiveValue | undefined, row: ParameterRow) => string;
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
  { key: "variableType", label: "Type", options: ["STRING", "INTEGER", "ENUM", "JSON"] },
  { key: "pinType", label: "Pin Type", options: ["Not Assigned", "ANALOG", "DIGITAL"] },
];

const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name" },
  { key: "variableType", label: "Type" },
  {
    key: "pinCount",
    label: "Pin Count",
    format: (value) => (Number(value || 0) > 0 ? String(value) : "Not Assigned"),
  },
  {
    key: "pinType",
    label: "Pin Type",
    format: (value) => (String(value || "").trim() ? String(value) : "Not Assigned"),
  },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const INITIAL_ROWS: ParameterRow[] = [];

const BADGE_KEYS = new Set(["variableType", "pinType"]);

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
    vendors: "",
    variableType: "",
    pinType: "",
    pinCount: "",
    isConstant: false,
  };
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  STRING: "bg-violet-50 text-violet-700 border-violet-200",
  INTEGER: "bg-sky-50 text-sky-700 border-sky-200",
  FLOAT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  BOOLEAN: "bg-cyan-50 text-cyan-700 border-cyan-200",
  ARRAY: "bg-lime-50 text-lime-700 border-lime-200",
  INTEGER_RANGE: "bg-blue-50 text-blue-700 border-blue-200",
  FLOAT_RANGE: "bg-purple-50 text-purple-700 border-purple-200",
  ENUM: "bg-amber-50 text-amber-700 border-amber-200",
  JSON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ANALOG: "bg-orange-50 text-orange-700 border-orange-200",
  DIGITAL: "bg-blue-50 text-blue-700 border-blue-200",
  Analog: "bg-orange-50 text-orange-700 border-orange-200",
  Digital: "bg-blue-50 text-blue-700 border-blue-200",
  "Not Assigned": "bg-gray-100 text-gray-500 border-gray-200",
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
export default function ParameterManagementPage() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filters, setFilters] = useState<Record<string, string>>(
    FILTERS.reduce<Record<string, string>>((acc, f) => {
      acc[f.key] = "all";
      return acc;
    }, {})
  );
  const [formValues, setFormValues] = useState<Record<string, PrimitiveValue>>(buildDefaults());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    ParameterRow,
    Partial<ParameterRow>,
    Partial<ParameterRow>
  >(deviceInventoryApi.parameters, { initialRows: INITIAL_ROWS });
  const { rows: vendorRows, loading: vendorsLoading } = useCrudResource<
    VendorRow,
    Partial<VendorRow>,
    Partial<VendorRow>
  >(deviceInventoryApi.vendors, { initialRows: [] });

  const vendorOptions = useMemo<string[]>(() => {
    const unique = new Set<string>();

    vendorRows.forEach((row) => {
      const vendorName = String(row.name ?? row.vendorName ?? "").trim();
      if (vendorName) {
        unique.add(vendorName);
      }
    });

    const selectedVendor = String(formValues.vendors ?? "").trim();
    if (selectedVendor) {
      unique.add(selectedVendor);
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [formValues.vendors, vendorRows]);

  const filteredRows = useMemo<ParameterRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const searchPass =
        !q ||
        ["name", "variableType", "pinType", "vendors"].some((k) =>
          String(row[k] ?? "").toLowerCase().includes(q)
        );
      const filterPass = FILTERS.every((f) => {
        const fv = filters[f.key];
        return !fv || fv === "all" || String(row[f.key] ?? "") === fv;
      });
      return searchPass && filterPass;
    });
  }, [filters, rows, searchTerm]);

  const stringCount = rows.filter((r) => r.variableType === "STRING").length;
  const enumCount = rows.filter((r) => r.variableType === "ENUM").length;
  const jsonCount = rows.filter((r) => r.variableType === "JSON").length;

  const openCreate = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(true);
  };

  const openEdit = (row: ParameterRow): void => {
    setFormValues({
      name: row.name ?? "",
      vendors: row.vendors ?? "",
      variableType: row.variableType ?? "",
      pinType: row.pinType ?? "",
      pinCount: row.pinCount ?? "",
      isConstant: Boolean(row.isConstant),
    });
    setEditingId(row.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteOne(id);
    } catch {
      return;
    }
    setDeleteConfirm(null);
  };

  const saveParameter = async (): Promise<boolean> => {
    const name = String(formValues.name ?? "").trim();
    const vendors = String(formValues.vendors ?? "").trim();
    const variableType = String(formValues.variableType ?? "").trim();
    if (!name || !vendors || !variableType) {
      return false;
    }

    const now = new Date().toISOString();
    const payload = {
      name,
      vendors,
      variableType,
      pinType: String(formValues.pinType ?? ""),
      pinCount: Number(formValues.pinCount ?? 0) || 0,
      isConstant: Boolean(formValues.isConstant),
    };

    try {
      if (editingId) {
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
    void saveParameter();
  };

  const goToPreviousPage = (): void => {
    const previousPage = getAdjacentDeviceQueryKey("parameterPage", "previous") ?? "parameterPage";
    navigate(buildDevicePageUrl(previousPage));
  };

  const handleSaveAndNext = async (): Promise<void> => {
    const saved = await saveParameter();
    if (!saved) return;

    const nextPage = getAdjacentDeviceQueryKey("parameterPage", "next");
    if (nextPage) {
      navigate(buildDevicePageUrl(nextPage));
    }
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
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

  const hasActiveFilters: boolean =
    !!searchTerm || FILTERS.some((f) => filters[f.key] !== "all");

  const resolveCell = (col: ColumnConfig, row: ParameterRow) => {
    const raw = row[col.key];
    const display = col.format ? col.format(raw, row) : fmt(raw);

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
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex items-start justify-between px-12 pt-12 pb-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Device Configuration
          </p>
          <h1
            className="text-[44px] text-slate-900"
            style={{ fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}
          >
            Parameter Management
          </h1>
          <p className="mt-2.5 text-[14px] text-slate-500">
            Define and manage parameter types for item and device configuration.
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
              Add Parameter
            </>
          )}
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="px-12 mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Parameters"
          value={String(rows.length)}
          sub={`${stringCount} string params`}
        />
        <StatCard
          label="String Parameters"
          value={String(stringCount)}
          sub="text-based values"
        />
        <StatCard
          label="Enum Parameters"
          value={String(enumCount)}
          sub="enumerated options"
        />
        <StatCard
          label="JSON Parameters"
          value={String(jsonCount)}
          sub="structured objects"
        />
      </div>
      {error && (
        <div className="px-12 mt-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        </div>
      )}
      {loading && (
        <div className="px-12 mt-4">
          <p className="text-[12px] text-slate-500">Loading parameters...</p>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="px-12 mt-8 pb-14 flex gap-6 items-start">

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
                placeholder="Search parameters…"
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
                          <p className="text-[13px] font-semibold text-slate-500">No parameters found</p>
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
                              aria-label="Edit parameter"
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
                                aria-label="Delete parameter"
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
                {filteredRows.length} parameter{filteredRows.length !== 1 ? "s" : ""}
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
        <RightDrawer open={formOpen} onClose={handleCancel}>
          <ParameterForm
            formId="parameter-form"
            formTitle={editingId ? "Edit Parameter" : "New Parameter"}
            formSubtitle={editingId 
              ? "Update the parameter details below." 
              : "Fill in the details to create a new parameter."
            }
            editing={!!editingId}
            values={formValues}
            vendorOptions={vendorOptions}
            vendorsLoading={vendorsLoading}
            onValueChange={(key, value) => 
              setFormValues(prev => ({ ...prev, [key]: value }))
            }
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onSaveAndNext={handleSaveAndNext}
            onBack={goToPreviousPage}
          />
        </RightDrawer>
      </div>
    </div>
  );
}




