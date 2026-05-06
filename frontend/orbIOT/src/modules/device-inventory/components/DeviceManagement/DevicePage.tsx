import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
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
import { RightDrawer } from "../management/ui";
import { deviceInventoryApi, type IotProvisionResponse } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type DeviceRow = {
  id: string | number;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

type VendorRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendorName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type ItemTypeRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendorName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type CommunicationRow = {
  id: string | number;
  name?: PrimitiveValue;
  itemType?: PrimitiveValue;
  itemTypeName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type ItemRow = {
  id: string | number;
  name?: PrimitiveValue;
  itemCode?: PrimitiveValue;
  vendor?: PrimitiveValue;
  itemType?: PrimitiveValue;
  communicationPolicy?: PrimitiveValue;
  metadata?: PrimitiveValue;
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

function readStringFromUnknown(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseJsonRecord(value: PrimitiveValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function buildCatalogMetadata(
  values: Record<string, PrimitiveValue>,
  fallbackThingName: string
): string {
  const base = parseJsonRecord(values.metadata);
  const catalog = readRecord(base.catalog) ?? {};
  const provisioning = readRecord(catalog.provisioning) ?? {};

  const nextCatalog: Record<string, unknown> = {
    ...catalog,
    vendorName: readStringFromUnknown(values.vendorName) ?? readStringFromUnknown(catalog.vendorName) ?? undefined,
    itemType: readStringFromUnknown(values.itemTypeName) ?? readStringFromUnknown(catalog.itemType) ?? undefined,
    itemName: readStringFromUnknown(values.itemName) ?? readStringFromUnknown(catalog.itemName) ?? undefined,
    itemCode: readStringFromUnknown(values.itemCode) ?? readStringFromUnknown(catalog.itemCode) ?? undefined,
    communicationPolicy:
      readStringFromUnknown(values.communicationPolicy) ??
      readStringFromUnknown(catalog.communicationPolicy) ??
      undefined,
    thingName: readStringFromUnknown(catalog.thingName) ?? fallbackThingName,
    provisioning: {
      ...provisioning,
      thingName: readStringFromUnknown(provisioning.thingName) ?? readStringFromUnknown(catalog.thingName) ?? fallbackThingName,
      deviceType:
        readStringFromUnknown(provisioning.deviceType) ??
        readStringFromUnknown(catalog.deviceType) ??
        undefined,
      channels:
        readStringFromUnknown(provisioning.channels) ??
        readStringFromUnknown(catalog.channels) ??
        undefined,
      policyName:
        readStringFromUnknown(provisioning.policyName) ??
        readStringFromUnknown(catalog.policyName) ??
        undefined,
    },
  };

  const cleanedCatalog = Object.fromEntries(
    Object.entries(nextCatalog).filter(([, entryValue]) => entryValue !== undefined && entryValue !== "")
  );

  return JSON.stringify(
    {
      ...base,
      catalog: cleanedCatalog,
    },
    null,
    2
  );
}

function parseProvisioningConfig(
  metadataValue: PrimitiveValue | undefined,
  defaults: {
    name: string;
    project: string;
    connectionType: string;
    fallbackThingName: string;
  }
) {
  const baseAttributes: Record<string, string> = {
    displayName: sanitizeAwsIotAttributeValue(defaults.name),
    project: sanitizeAwsIotAttributeValue(defaults.project),
    connectionType: sanitizeAwsIotAttributeValue(defaults.connectionType),
  };

  if (!metadataValue || typeof metadataValue !== "string") {
    return {
      deviceId: defaults.fallbackThingName,
      thingName: defaults.fallbackThingName,
      attributes: baseAttributes,
    };
  }

  try {
    const parsed = JSON.parse(metadataValue) as Record<string, unknown>;
    const catalog = readRecord(parsed.catalog) ?? {};
    const provisioning = readRecord(catalog.provisioning) ?? catalog;
    const provisioningAttributes = readRecord(provisioning.attributes) ?? {};

    const attributes = Object.entries(provisioningAttributes).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === null || value === undefined) return acc;
        const sanitized = sanitizeAwsIotAttributeValue(String(value));
        if (sanitized) acc[key] = sanitized;
        return acc;
      },
      { ...baseAttributes }
    );

    const thingName =
      readStringFromUnknown(provisioning.thingName) ??
      readStringFromUnknown(catalog.thingName) ??
      defaults.fallbackThingName;

    const connectAdminDeviceId =
      readStringFromUnknown(provisioning.connectAdminDeviceId) ??
      readStringFromUnknown(catalog.connectAdminDeviceId) ??
      readStringFromUnknown(catalog.thingId) ??
      thingName;

    return {
      deviceId: connectAdminDeviceId,
      thingName,
      deviceType: readStringFromUnknown(provisioning.deviceType) ?? readStringFromUnknown(catalog.deviceType),
      policyName: readStringFromUnknown(provisioning.policyName) ?? readStringFromUnknown(catalog.policyName),
      s3Prefix: readStringFromUnknown(provisioning.s3Prefix) ?? readStringFromUnknown(catalog.s3Prefix),
      channels: readStringFromUnknown(provisioning.channels) ?? readStringFromUnknown(catalog.channels),
      forceProvision:
        typeof provisioning.forceProvision === "boolean"
          ? provisioning.forceProvision
          : typeof catalog.forceProvision === "boolean"
            ? catalog.forceProvision
            : undefined,
      attributes,
    };
  } catch {
    return {
      deviceId: defaults.fallbackThingName,
      thingName: defaults.fallbackThingName,
      attributes: baseAttributes,
    };
  }
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
  const [searchParams] = useSearchParams();
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
  const { rows: vendorRows, loading: vendorsLoading } = useCrudResource<
    VendorRow,
    Partial<VendorRow>,
    Partial<VendorRow>
  >(deviceInventoryApi.vendors, { initialRows: [] });
  const { rows: itemTypeRows, loading: itemTypesLoading } = useCrudResource<
    ItemTypeRow,
    Partial<ItemTypeRow>,
    Partial<ItemTypeRow>
  >(deviceInventoryApi.itemTypes, { initialRows: [] });
  const { rows: communicationRows, loading: communicationPoliciesLoading } = useCrudResource<
    CommunicationRow,
    Partial<CommunicationRow>,
    Partial<CommunicationRow>
  >(deviceInventoryApi.communications, { initialRows: [] });
  const { rows: itemRows } = useCrudResource<
    ItemRow,
    Partial<ItemRow>,
    Partial<ItemRow>
  >(deviceInventoryApi.items, { initialRows: [] });

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
  const vendorOptions = useMemo(() => {
    const values = new Set<string>();
    vendorRows.forEach((row) => {
      const name = String(row.name ?? row.vendorName ?? "").trim();
      if (name) values.add(name);
    });
    itemRows.forEach((row) => {
      const name = String(row.vendor ?? "").trim();
      if (name) values.add(name);
    });
    const current = String(formValues.vendorName ?? "").trim();
    if (current) values.add(current);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [formValues.vendorName, itemRows, vendorRows]);

  const itemTypeOptions = useMemo(() => {
    const values = new Set<string>();
    const selectedVendor = String(formValues.vendorName ?? "").trim().toLowerCase();
    itemTypeRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;
      const vendorName = String(row.vendorName ?? "").trim().toLowerCase();
      if (!selectedVendor || !vendorName || vendorName === selectedVendor) {
        values.add(name);
      }
    });
    itemRows.forEach((row) => {
      const typeName = String(row.itemType ?? "").trim();
      const vendorName = String(row.vendor ?? "").trim().toLowerCase();
      if (typeName && (!selectedVendor || !vendorName || vendorName === selectedVendor)) {
        values.add(typeName);
      }
    });
    const current = String(formValues.itemTypeName ?? "").trim();
    if (current) values.add(current);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [formValues.itemTypeName, formValues.vendorName, itemRows, itemTypeRows]);

  const communicationPolicyOptions = useMemo(() => {
    const values = new Set<string>();
    const selectedItemType = String(formValues.itemTypeName ?? "").trim().toLowerCase();
    communicationRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      const itemType = String(row.itemType ?? row.itemTypeName ?? "").trim().toLowerCase();
      if (name && (!selectedItemType || !itemType || itemType === selectedItemType)) {
        values.add(name);
      }
    });
    itemRows.forEach((row) => {
      const name = String(row.communicationPolicy ?? "").trim();
      const itemType = String(row.itemType ?? "").trim().toLowerCase();
      if (name && (!selectedItemType || !itemType || itemType === selectedItemType)) {
        values.add(name);
      }
    });
    const current = String(formValues.communicationPolicy ?? "").trim();
    if (current) values.add(current);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [communicationRows, formValues.communicationPolicy, formValues.itemTypeName, itemRows]);

  useEffect(() => {
    const shouldCreate = searchParams.get("create");
    const requestedVendor = String(searchParams.get("vendorName") ?? "").trim();

    if (shouldCreate !== "true") return;
    if (formOpen || selectedDeviceId !== null || editingId !== null) return;

    setFormValues((prev) => ({
      ...prev,
      vendorName: requestedVendor || String(prev.vendorName ?? ""),
    }));
    setSubmitError(null);
    setFormOpen(true);
  }, [editingId, formOpen, searchParams, selectedDeviceId]);

  const openCreate = (): void => {
    setEditingId(null);
    setSelectedDeviceId(null);
    setFormValues({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (row: DeviceRow): void => {
    const metadata = parseJsonRecord(row.metadata);
    const catalog = readRecord(metadata.catalog) ?? {};
    setSelectedDeviceId(null);
    setFormValues({
      ...row,
      vendorName: String(catalog.vendorName ?? row.vendorName ?? ""),
      itemTypeName: String(catalog.itemType ?? row.itemTypeName ?? row.itemType ?? ""),
      itemName: String(catalog.itemName ?? row.itemName ?? ""),
      itemCode: String(catalog.itemCode ?? row.itemCode ?? ""),
      communicationPolicy: String(catalog.communicationPolicy ?? row.communicationPolicy ?? ""),
    });
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
        await updateOne(editingId, {
          ...formValues,
          metadata: buildCatalogMetadata(
            formValues,
            readStringFromUnknown(formValues.foreignId) ??
              readStringFromUnknown(formValues.serialNumber) ??
              generateProvisioningUuid()
          ),
          updatedAt: now,
        });
      } else {
        const thingName = generateProvisioningUuid();
        const catalogMetadata = buildCatalogMetadata(formValues, thingName);
        const provisioningConfig = parseProvisioningConfig(catalogMetadata, {
          name,
          project,
          connectionType,
          fallbackThingName: thingName,
        });
        const provisioningData = await deviceInventoryApi.iot.provisionThing(provisioningConfig);

        const thingId =
          provisioningData.device?.thingId ??
          provisioningData.provisioning?.thingName ??
          thingName;

        const created = await createOne({
          ...formValues,
          foreignId: thingId,
          status: "active",
          metadata: buildMergedMetadata(catalogMetadata, provisioningData, thingId),
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
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "vendorName") {
        next.itemTypeName = "";
        next.communicationPolicy = "";
        next.itemName = "";
        next.itemCode = "";
      }

      if (key === "itemTypeName") {
        next.communicationPolicy = "";
        const matchingItem = itemRows.find((row) => {
          const rowType = String(row.itemType ?? "").trim().toLowerCase();
          const rowVendor = String(row.vendor ?? "").trim().toLowerCase();
          const selectedType = String(value ?? "").trim().toLowerCase();
          const selectedVendor = String(next.vendorName ?? "").trim().toLowerCase();
          return rowType === selectedType && (!selectedVendor || rowVendor === selectedVendor);
        });

        if (matchingItem) {
          next.itemName = String(matchingItem.name ?? "");
          next.itemCode = String(matchingItem.itemCode ?? "");
          if (!next.communicationPolicy && matchingItem.communicationPolicy) {
            next.communicationPolicy = String(matchingItem.communicationPolicy);
          }
        }
      }

      if (key === "communicationPolicy" && !next.itemCode) {
        const matchingItem = itemRows.find((row) => {
          const rowType = String(row.itemType ?? "").trim().toLowerCase();
          const rowPolicy = String(row.communicationPolicy ?? "").trim().toLowerCase();
          const selectedType = String(next.itemTypeName ?? "").trim().toLowerCase();
          const selectedPolicy = String(value ?? "").trim().toLowerCase();
          return rowPolicy === selectedPolicy && (!selectedType || rowType === selectedType);
        });

        if (matchingItem) {
          next.itemName = String(matchingItem.name ?? "");
          next.itemCode = String(matchingItem.itemCode ?? "");
        }
      }

      return next;
    });
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
            <><X size={14} strokeWidth={2.5} />Close Panel</>
          ) : formOpen ? (
            <><X size={14} strokeWidth={2.5} />Close</>
          ) : (
            <><Plus size={15} strokeWidth={2.5} />Add Device</>
          )}
        </button>
      </div>

      {selectedDevice ? (
        <div className="px-12 mt-8 pb-14">
          <button
            type="button"
            onClick={() => setSelectedDeviceId(null)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Devices
          </button>

          <div className="mt-5">
            <DeviceDetailsView
              device={selectedDevice}
              onBack={() => setSelectedDeviceId(null)}
              onEdit={() => openEdit(selectedDevice)}
            />
          </div>
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
        <RightDrawer open={formOpen} onClose={handleCancel} size="large">
          <div className="form-scroll h-full overflow-y-auto">
            <DeviceForm
              formId="device-form"
              formTitle={editingId ? "Edit Device" : "Create New Device"}
              formSubtitle={editingId ? "Update the device details below." : "Enter the details for the new device"}
              editing={!!editingId}
              values={formValues}
              vendorOptions={vendorOptions}
              itemTypeOptions={itemTypeOptions}
              communicationPolicyOptions={communicationPolicyOptions}
              vendorsLoading={vendorsLoading}
              itemTypesLoading={itemTypesLoading}
              communicationPoliciesLoading={communicationPoliciesLoading}
              onValueChange={handleValueChange}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSaving={isSaving}
            />
          </div>
        </RightDrawer>
      </div>
      </>
      )}
    </div>
  );
}





