import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Pencil,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import ItemtypeForm from "./ItemtypeForm";
import { buildDevicePageUrl, getAdjacentDeviceQueryKey } from "../management/flow";
import { RightDrawer } from "../management/ui";
import { deviceInventoryApi } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type ItemTypeRow = {
  id: string | number;
  name: string;
  synonyms: string;
  vendorName: string;
  parameterName?: string;
  createdAt: string;
  updatedAt: string;
};

type VendorRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendorName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type ParameterRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendors?: PrimitiveValue;
  vendorName?: PrimitiveValue;
  variableType?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

interface ParameterOption {
  name: string;
  variableType: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: PrimitiveValue | undefined, row: ItemTypeRow) => string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "NAME" },
  {
    key: "synonyms",
    label: "SYNONYMS",
    format: (value) => (String(value || "").trim() ? String(value) : "—"),
  },
  { key: "vendorName", label: "VENDOR" },
  { key: "createdAt", label: "CREATED" },
  { key: "updatedAt", label: "UPDATED" },
];

const INITIAL_ROWS: ItemTypeRow[] = [];

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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="inventory-kpi-card rounded-lg p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="inventory-kpi-value text-2xl mt-1">{value}</p>
      <p className="text-xs mt-1 text-slate-500">{sub}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ItemTypeManagementPage() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [formValues, setFormValues] = useState<Partial<ItemTypeRow>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    ItemTypeRow,
    Partial<ItemTypeRow>,
    Partial<ItemTypeRow>
  >(deviceInventoryApi.itemTypes, { initialRows: INITIAL_ROWS });
  const { rows: vendorRows, loading: vendorsLoading } = useCrudResource<
    VendorRow,
    Partial<VendorRow>,
    Partial<VendorRow>
  >(deviceInventoryApi.vendors, { initialRows: [] });
  const { rows: parameterRows, loading: parametersLoading } = useCrudResource<
    ParameterRow,
    Partial<ParameterRow>,
    Partial<ParameterRow>
  >(deviceInventoryApi.parameters, { initialRows: [] });

  const filteredRows = useMemo<ItemTypeRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) =>
      !q ||
      ["name", "synonyms", "vendorName"].some((k) =>
        String(row[k as keyof ItemTypeRow] ?? "").toLowerCase().includes(q)
      )
    );
  }, [rows, searchTerm]);

  const uniqueVendors = new Set(rows.map((r) => String(r.vendorName || "")).filter(Boolean));
  const vendorOptions = useMemo<string[]>(() => {
    const unique = new Set<string>();

    vendorRows.forEach((row) => {
      const vendorName = String(row.name ?? row.vendorName ?? "").trim();
      if (vendorName) unique.add(vendorName);
    });

    rows.forEach((row) => {
      const vendorName = String(row.vendorName ?? "").trim();
      if (vendorName) unique.add(vendorName);
    });

    const selectedVendor = String(formValues.vendorName ?? "").trim();
    if (selectedVendor) unique.add(selectedVendor);

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [formValues.vendorName, rows, vendorRows]);

  const parameterOptions = useMemo<ParameterOption[]>(() => {
    const selectedVendor = String(formValues.vendorName ?? "").trim().toLowerCase();
    if (!selectedVendor) return [];

    const deduped = new Map<string, ParameterOption>();

    parameterRows.forEach((row) => {
      const vendorField = String(row.vendors ?? row.vendorName ?? "");
      const matchesVendor = vendorField
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .includes(selectedVendor);

      if (!matchesVendor) return;

      const name = String(row.name ?? "").trim();
      if (!name) return;

      deduped.set(name, {
        name,
        variableType: String(row.variableType ?? "").trim(),
      });
    });

    const selectedParameter = String(formValues.parameterName ?? "").trim();
    if (selectedParameter && !deduped.has(selectedParameter)) {
      deduped.set(selectedParameter, {
        name: selectedParameter,
        variableType: "",
      });
    }

    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [formValues.parameterName, formValues.vendorName, parameterRows]);

  const openCreate = (): void => {
    setEditingId(null);
    setFormValues({});
    setFormOpen(true);
  };

  const openEdit = (row: ItemTypeRow): void => {
    setFormValues(row);
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

  const saveItemType = async (values: Partial<ItemTypeRow>): Promise<boolean> => {
    const name = String(values.name ?? "").trim();
    if (!name) {
      return false;
    }

    const now = new Date().toISOString();

    const payload: Partial<ItemTypeRow> = {
      name,
      synonyms: String(values.synonyms ?? ""),
      vendorName: String(values.vendorName ?? ""),
      parameterName: String(values.parameterName ?? ""),
    };

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
    setFormValues({});
    setFormOpen(false);
    return true;
  };

  const handleSubmit = (values: Partial<ItemTypeRow>): void => {
    void saveItemType(values);
  };

  const goToPreviousPage = (): void => {
    const previousPage = getAdjacentDeviceQueryKey("itemTypePage", "previous") ?? "itemTypePage";
    navigate(buildDevicePageUrl(previousPage));
  };

  const handleSaveAndNext = async (): Promise<void> => {
    const saved = await saveItemType(formValues);
    if (!saved) return;

    const nextPage = getAdjacentDeviceQueryKey("itemTypePage", "next");
    if (nextPage) {
      navigate(buildDevicePageUrl(nextPage));
    }
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues({});
    setFormOpen(false);
  };

  const resolveCell = (col: ColumnConfig, row: ItemTypeRow) => {
    const display = col.format ? col.format(row[col.key as keyof ItemTypeRow], row) : fmt(row[col.key as keyof ItemTypeRow]);
    return (
      <span
        className={`text-sm ${
          col.key === "name"
            ? "font-medium text-gray-900"
            : col.key === "synonyms" && display !== "—"
            ? "text-gray-500"
            : "text-gray-500"
        }`}
      >
        {display}
      </span>
    );
  };

  return (
    <div className="inventory-page-theme min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          DEVICE INVENTORY
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Type Management</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage item types and their optional synonyms.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Item Type
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="ITEM TYPE SUMMARY"
            value={String(rows.length)}
            sub={`${rows.length} item types in platform`}
          />
          <StatCard
            label="TOTAL ITEMS"
            value={String(rows.length)}
            sub="avg by type"
          />
          <StatCard
            label="MAX ITEMS PER TYPE"
            value={rows.length ? "3" : "0"}
            sub="across all types"
          />
          <StatCard
            label="VENDORS"
            value={String(uniqueVendors.size)}
            sub="unique vendors linked"
          />
        </div>
        {error && (
          <div className="mb-4">
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
              {error}
            </p>
          </div>
        )}
        {loading && (
          <div className="mb-4">
            <p className="text-[12px] text-slate-500">Loading item types...</p>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="flex gap-6">
          {/* Left Column - Table */}
          <div className={`${formOpen ? 'flex-1' : 'w-full'} transition-all duration-300`}>
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search item types..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                        No item types found
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-4 py-3">
                            {resolveCell(col, row)}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(row)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            {deleteConfirm === row.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(row.id)}
                                  className="text-xs text-red-600 font-medium hover:text-red-700"
                                >
                                  Yes
                                </button>
                                <span className="text-gray-300">/</span>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-xs text-gray-500 font-medium hover:text-gray-600"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(row.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
                {filteredRows.length} item type{filteredRows.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <RightDrawer open={formOpen} onClose={handleCancel}>
            <ItemtypeForm
              formId="item-type-form"
              formTitle={editingId ? "Edit Item Type" : "New Item Type"}
              formSubtitle={editingId ? "Update the item type details below." : "Create a new item type and optional synonyms."}
              editing={!!editingId}
              values={formValues}
              vendorOptions={vendorOptions}
              vendorsLoading={vendorsLoading}
              parameterOptions={parameterOptions}
              parametersLoading={parametersLoading}
              onValueChange={(key, value) => setFormValues(prev => ({ ...prev, [key]: value }))}
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(formValues);
              }}
              onCancel={handleCancel}
              onBack={goToPreviousPage}
              onSaveAndNext={handleSaveAndNext}
            />
          </RightDrawer>
        </div>
      </div>
    </div>
  );
}

