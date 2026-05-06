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
import ItemForm from "./ItemForm";
import { buildDevicePageUrl, getAdjacentDeviceQueryKey } from "../management/flow";
import { RightDrawer } from "../management/ui";
import { deviceInventoryApi } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type ItemRow = {
  id: string | number;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

type VendorRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendorName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type ItemTypeEntityRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendorName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type CommunicationEntityRow = {
  id: string | number;
  name?: PrimitiveValue;
  itemType?: PrimitiveValue;
  itemTypeName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

interface FilterConfig {
  key: string;
  label: string;
  options: string[];
}

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: PrimitiveValue | undefined, row: ItemRow) => string;
}

interface FormField {
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  placeholder?: string;
  options?: string[];
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

interface BadgeProps {
  value: string;
  variant?: "yesno" | "default";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS: FilterConfig[] = [
  { key: "gateway", label: "Gateway", options: ["Yes", "No"] },
  { key: "secureItem", label: "Secure", options: ["Yes", "No"] },
];

const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name" },
  { key: "itemCode", label: "Item Code" },
  { key: "itemTypeName", label: "Item Type" },
  { key: "gateway", label: "Gateway" },
  { key: "secureItem", label: "Secure" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const FORM_FIELDS: FormField[] = [
  { key: "name", label: "Item Name", type: "text", placeholder: "e.g. item" },
  { key: "itemCode", label: "Item Code", type: "text", placeholder: "e.g. 001" },
  { key: "itemTypeName", label: "Item Type Name", type: "text", placeholder: "e.g. smart_switch" },
  { key: "vendorName", label: "Vendor Name", type: "text", placeholder: "e.g. acme_vendor" },
  { key: "gateway", label: "Gateway", type: "boolean" },
  { key: "secureItem", label: "Secure Item", type: "boolean" },
];

const INITIAL_ROWS: ItemRow[] = [];

const YESNO_KEYS = new Set(["gateway", "secureItem"]);

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
  return FORM_FIELDS.reduce<Record<string, PrimitiveValue>>((acc, f) => {
    if (f.type === "boolean") acc[f.key] = false;
    else if (f.type === "select") acc[f.key] = f.options?.[0] ?? "";
    else acc[f.key] = "";
    return acc;
  }, {});
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ value, variant = "default" }: BadgeProps) {
  const yesNo: Record<string, string> = {
    Yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    No: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const cls =
    variant === "yesno"
      ? yesNo[value] ?? "bg-gray-100 text-gray-600 border-gray-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
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

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Main Component ───────────────────────────────────────────────────────────
export default function ItemManagementPage() {
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
    ItemRow,
    Partial<ItemRow>,
    Partial<ItemRow>
  >(deviceInventoryApi.items, { initialRows: INITIAL_ROWS });
  const { rows: vendorRows, loading: vendorsLoading } = useCrudResource<
    VendorRow,
    Partial<VendorRow>,
    Partial<VendorRow>
  >(deviceInventoryApi.vendors, { initialRows: [] });
  const { rows: itemTypeRows, loading: itemTypesLoading } = useCrudResource<
    ItemTypeEntityRow,
    Partial<ItemTypeEntityRow>,
    Partial<ItemTypeEntityRow>
  >(deviceInventoryApi.itemTypes, { initialRows: [] });
  const { rows: communicationRows, loading: communicationPoliciesLoading } = useCrudResource<
    CommunicationEntityRow,
    Partial<CommunicationEntityRow>,
    Partial<CommunicationEntityRow>
  >(deviceInventoryApi.communications, { initialRows: [] });

  // New form values state for ItemForm
  const [itemFormValues, setItemFormValues] = useState<Record<string, PrimitiveValue>>({
    name: "",
    itemCode: "",
    description: "",
    metadata: "",
    itemPollingConfig: "",
    vendor: "",
    itemType: "",
    communicationPolicy: "",
    gateway: "",
    icon: "",
  });

  const filteredRows = useMemo<ItemRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const searchPass =
        !q ||
        ["name", "itemCode", "itemTypeName", "vendorName"].some((k) =>
          String(row[k] ?? "").toLowerCase().includes(q)
        );
      const filterPass = FILTERS.every((f) => {
        const fv = filters[f.key];
        const currentValue =
          typeof row[f.key] === "boolean" ? (row[f.key] ? "Yes" : "No") : String(row[f.key] ?? "");
        return !fv || fv === "all" || currentValue === fv;
      });
      return searchPass && filterPass;
    });
  }, [filters, rows, searchTerm]);

  const uniqueTypes = new Set(rows.map((r) => String(r.itemTypeName || "")).filter(Boolean));
  const uniqueVendors = new Set(rows.map((r) => String(r.vendorName || "")).filter(Boolean));
  const gatewayCount = rows.filter(
    (r) => r.gateway === true || String(r.gateway).toLowerCase() === "yes"
  ).length;
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

    const selectedVendor = String(itemFormValues.vendor ?? formValues.vendorName ?? "").trim();
    if (selectedVendor) unique.add(selectedVendor);

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [formValues.vendorName, itemFormValues.vendor, rows, vendorRows]);

  const itemTypeOptions = useMemo<string[]>(() => {
    const selectedVendor = String(itemFormValues.vendor ?? "").trim().toLowerCase();
    const deduped = new Set<string>();

    itemTypeRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;

      if (!selectedVendor) {
        deduped.add(name);
        return;
      }

      const vendorName = String(row.vendorName ?? "").trim().toLowerCase();
      if (vendorName === selectedVendor) {
        deduped.add(name);
      }
    });

    if (!selectedVendor) {
      rows.forEach((row) => {
        const name = String(row.itemTypeName ?? "").trim();
        if (name) deduped.add(name);
      });
    } else {
      rows.forEach((row) => {
        const rowVendor = String(row.vendorName ?? "").trim().toLowerCase();
        const rowItemType = String(row.itemTypeName ?? "").trim();
        if (rowVendor === selectedVendor && rowItemType) {
          deduped.add(rowItemType);
        }
      });
    }

    const selectedItemType = String(itemFormValues.itemType ?? formValues.itemTypeName ?? "").trim();
    if (selectedItemType) deduped.add(selectedItemType);

    return Array.from(deduped).sort((a, b) => a.localeCompare(b));
  }, [formValues.itemTypeName, itemFormValues.itemType, itemFormValues.vendor, itemTypeRows, rows]);

  const communicationPolicyOptions = useMemo<string[]>(() => {
    const selectedItemType = String(itemFormValues.itemType ?? formValues.itemTypeName ?? "").trim().toLowerCase();
    const deduped = new Set<string>();

    communicationRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;

      if (!selectedItemType) {
        deduped.add(name);
        return;
      }

      const rowItemType = String(row.itemType ?? row.itemTypeName ?? "").trim().toLowerCase();
      if (!rowItemType || rowItemType === selectedItemType) {
        deduped.add(name);
      }
    });

    if (!selectedItemType) {
      rows.forEach((row) => {
        const policy = String(row.communicationPolicy ?? "").trim();
        if (policy) deduped.add(policy);
      });
    } else {
      rows.forEach((row) => {
        const rowItemType = String(row.itemTypeName ?? row.itemType ?? "").trim().toLowerCase();
        const policy = String(row.communicationPolicy ?? "").trim();
        if (rowItemType === selectedItemType && policy) {
          deduped.add(policy);
        }
      });
    }

    const selectedPolicy = String(itemFormValues.communicationPolicy ?? "").trim();
    if (selectedPolicy) deduped.add(selectedPolicy);

    return Array.from(deduped).sort((a, b) => a.localeCompare(b));
  }, [communicationRows, formValues.itemTypeName, itemFormValues.communicationPolicy, itemFormValues.itemType, rows]);

  const openCreate = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setItemFormValues({
      name: "",
      itemCode: "",
      description: "",
      metadata: "",
      itemPollingConfig: "",
      vendor: "",
      itemType: "",
      communicationPolicy: "",
      gateway: "",
      icon: "",
    });
    setFormOpen(true);
  };

  const openEdit = (row: ItemRow): void => {
    setFormValues(
      FORM_FIELDS.reduce<Record<string, PrimitiveValue>>((acc, f) => {
        if (f.type === "boolean") {
          acc[f.key] = String(row[f.key]) === "Yes" || row[f.key] === true;
        } else {
          acc[f.key] = row[f.key] ?? "";
        }
        return acc;
      }, {})
    );
    
    // Also set ItemForm values
    setItemFormValues({
      name: String(row.name || ""),
      itemCode: String(row.itemCode || ""),
      description: String(row.description || ""),
      metadata: String(row.metadata || ""),
      itemPollingConfig: String(row.itemPollingConfig || ""),
      vendor: String(row.vendorName || ""),
      itemType: String(row.itemTypeName || ""),
      communicationPolicy: String(row.communicationPolicy || ""),
      gateway: String(row.gateway || ""),
      icon: String(row.icon || ""),
    });
    
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

  const saveItem = async (): Promise<boolean> => {
    const name = String(itemFormValues.name ?? formValues.name ?? "").trim();
    const itemCode = String(itemFormValues.itemCode ?? formValues.itemCode ?? "").trim();
    const vendorName = String(itemFormValues.vendor ?? formValues.vendorName ?? "").trim();
    const itemTypeName = String(itemFormValues.itemType ?? formValues.itemTypeName ?? "").trim();
    const communicationPolicy = String(itemFormValues.communicationPolicy ?? "").trim();
    if (!name || !itemCode || !vendorName || !itemTypeName || !communicationPolicy) {
      return false;
    }

    const now = new Date().toISOString();
    const requiredBase: Record<string, PrimitiveValue> = {
      name,
      itemCode,
      communicationPolicy,
    };

    const optionalExtras: Record<string, PrimitiveValue> = {};
    const gatewayValue = String(itemFormValues.gateway ?? "").trim().toLowerCase();
    if (gatewayValue !== "" && gatewayValue !== "none") {
      optionalExtras.gateway = true;
    }
    if (Boolean(formValues.secureItem)) {
      optionalExtras.secureItem = true;
    }
    const icon = String(itemFormValues.icon ?? "").trim();
    if (icon) {
      optionalExtras.icon = icon;
    }
    const description = String(itemFormValues.description ?? "").trim();
    const metadata = String(itemFormValues.metadata ?? "").trim();
    const itemPollingConfig = String(itemFormValues.itemPollingConfig ?? "").trim();
    if (description) optionalExtras.description = description;
    if (metadata) optionalExtras.metadata = metadata;
    if (itemPollingConfig) optionalExtras.itemPollingConfig = itemPollingConfig;

    const persist = async (payload: Record<string, PrimitiveValue>): Promise<void> => {
      if (editingId !== null) {
        await updateOne(editingId, { ...payload, updatedAt: now });
        return;
      }
      await createOne({ ...payload, createdAt: now, updatedAt: now });
    };

    const candidatePayloads: Array<Record<string, PrimitiveValue>> = [
      { ...requiredBase, ...optionalExtras, vendorName, itemTypeName },
      { ...requiredBase, ...optionalExtras, vendor: vendorName, itemType: itemTypeName },
      { ...requiredBase, vendorName, itemTypeName },
      { ...requiredBase, vendor: vendorName, itemType: itemTypeName },
      { ...requiredBase, vendorName, itemType: itemTypeName },
      { ...requiredBase, vendor: vendorName, itemTypeName },
    ];

    const attempted = new Set<string>();

    for (const payload of candidatePayloads) {
      const signature = JSON.stringify(payload);
      if (attempted.has(signature)) {
        continue;
      }
      attempted.add(signature);

      try {
        await persist(payload);
        setEditingId(null);
        setFormValues(buildDefaults());
        setFormOpen(false);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const shouldRetryWithFallback =
          message.includes("validation") ||
          message.includes("(400)") ||
          message.includes("bad request");
        if (!shouldRetryWithFallback) {
          return false;
        }
      }
    }

    return false;
  };

  const handleSubmit = (): void => {
    void saveItem();
  };

  const handleItemFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setItemFormValues({
      name: "",
      itemCode: "",
      description: "",
      metadata: "",
      itemPollingConfig: "",
      vendor: "",
      itemType: "",
      communicationPolicy: "",
      gateway: "",
      icon: "",
    });
    setFormOpen(false);
  };

  const handleItemFormValueChange = (field: string, value: PrimitiveValue) => {
    setItemFormValues(prev => ({ ...prev, [field]: value }));

    // Keep table payload values in sync with the ItemForm model.
    if (field === "vendor") {
      setFormValues((prev) => ({ ...prev, vendorName: value }));
      setItemFormValues((prev) => ({ ...prev, itemType: "", communicationPolicy: "" }));
      setFormValues((prev) => ({ ...prev, itemTypeName: "" }));
      return;
    }
    if (field === "itemType") {
      setItemFormValues((prev) => ({ ...prev, communicationPolicy: "" }));
      setFormValues((prev) => ({ ...prev, itemTypeName: value }));
      return;
    }
    if (field === "gateway") {
      const hasGateway =
        String(value ?? "").trim() !== "" && String(value ?? "").toLowerCase() !== "none";
      setFormValues((prev) => ({ ...prev, gateway: hasGateway }));
      return;
    }
    if (field === "secureItem") {
      setFormValues((prev) => ({ ...prev, secureItem: value === true }));
      return;
    }
    if (field === "name" || field === "itemCode") {
      setFormValues((prev) => ({ ...prev, [field]: value }));
    }
  };

  const goToPreviousPage = (): void => {
    const previousPage = getAdjacentDeviceQueryKey("itemPage", "previous") ?? "itemPage";
    navigate(buildDevicePageUrl(previousPage));
  };

  const handleSaveAndNext = async (): Promise<void> => {
    const saved = await saveItem();
    if (!saved) return;

    const nextPage = getAdjacentDeviceQueryKey("itemPage", "next");
    if (nextPage) {
      navigate(buildDevicePageUrl(nextPage));
    }
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

  const resolveCell = (col: ColumnConfig, row: ItemRow) => {
    const display = col.format ? col.format(row[col.key], row) : fmt(row[col.key]);
    if (YESNO_KEYS.has(col.key)) {
      return <Badge value={display} variant="yesno" />;
    }
    return (
      <span
        className={`text-[13px] ${
          col.key === "name"
            ? "font-bold text-slate-900"
            : col.key === "itemCode"
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
            Item Management
          </h1>
          <p className="mt-2.5 text-[14px] text-slate-500">
            Create inventory items and map them to item types.
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
            <><X size={14} strokeWidth={2.5} />Close</>
          ) : (
            <><Plus size={15} strokeWidth={2.5} />Add Item</>
          )}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="px-12 mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Item & Device Overview" value={String(rows.length)} sub={`${rows.length} items managed`} />
        <StatCard label="Item Types" value={String(uniqueTypes.size)} sub="unique item types" />
        <StatCard label="Vendors" value={String(uniqueVendors.size)} sub="unique vendors linked" />
        <StatCard label="Gateways" value={String(gatewayCount)} sub="gateway-enabled items" />
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
          <p className="text-[12px] text-slate-500">Loading items...</p>
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
                placeholder="Search items…"
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
                          <p className="text-[13px] font-semibold text-slate-500">No items found</p>
                          <p className="text-[12px] text-slate-400">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70 ${editingId === row.id ? "bg-blue-50/30" : ""}`}
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
                              className={`rounded-lg p-2 transition-colors ${editingId === row.id ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
                              aria-label="Edit item"
                            >
                              <Pencil size={13} strokeWidth={2.2} />
                            </button>
                            {deleteConfirm === row.id ? (
                              <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                                <span className="text-[11px] font-semibold text-red-600 mr-1">Delete?</span>
                                <button type="button" onClick={() => handleDelete(row.id)} className="text-[11px] font-bold text-red-600 hover:text-red-800 transition-colors">Yes</button>
                                <span className="text-red-200 mx-0.5">/</span>
                                <button type="button" onClick={() => setDeleteConfirm(null)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">No</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setDeleteConfirm(row.id)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" aria-label="Delete item">
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
              <span>{filteredRows.length} item{filteredRows.length !== 1 ? "s" : ""}</span>
              <span>{filteredRows.length === 0 ? "0 results" : `1–${filteredRows.length} of ${rows.length}`}</span>
            </div>
          </div>
        </div>

        {/* Side Form Panel - Using ItemForm */}
        <RightDrawer open={formOpen} onClose={handleCancel} size="large">
          <ItemForm
            formId="item-form"
            formTitle={editingId ? "Edit Item" : "New Item"}
            formSubtitle={
              editingId
                ? "Update the item details below."
                : "Create an inventory item and map it to an item type."
            }
            editing={!!editingId}
            values={itemFormValues}
            vendorOptions={vendorOptions}
            itemTypeOptions={itemTypeOptions}
            communicationPolicyOptions={communicationPolicyOptions}
            vendorsLoading={vendorsLoading}
            itemTypesLoading={itemTypesLoading}
            communicationPoliciesLoading={communicationPoliciesLoading}
            onValueChange={handleItemFormValueChange}
            onSubmit={handleItemFormSubmit}
            onCancel={handleCancel}
            onBack={goToPreviousPage}
            onSaveAndNext={handleSaveAndNext}
          />
        </RightDrawer>
      </div>
    </div>
  );
}





