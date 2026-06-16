import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Wifi,
  ShieldCheck,
  Cpu,
  Router,
  RadioTower,
  Cable,
} from "lucide-react";
import DeviceWorkflowBuilder from "./DeviceWorkflowBuilder";
import DeviceDetailsView from "./DeviceDetailsView";
import { deviceInventoryApi, type IotProvisionResponse } from "../../api";
import { useCrudResource } from "../../hooks";
import { RightDrawer } from "../management/ui";

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
  groupName?: PrimitiveValue;
  itemType?: PrimitiveValue;
  itemTypeName?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type ParameterRow = {
  id: string | number;
  name?: PrimitiveValue;
  vendors?: PrimitiveValue;
  variableType?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type MessageRow = {
  id: string | number;
  name?: PrimitiveValue;
  topic?: PrimitiveValue;
  itemType?: PrimitiveValue;
  communicationPolicy?: PrimitiveValue;
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
  progress: number;
  tone: "slate" | "amber" | "emerald" | "blue";
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
  { key: "connectionType", label: "Connection" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Updated" },
];

const PAGE_SIZE = 8;

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

function generateThingTypeName(deviceType: string): string {
  const normalizedType = deviceType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_:]+|[-_:]+$/g, "");

  return `ccms-${normalizedType || "single"}`;
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

function matchesCatalogVendor(rawValue: PrimitiveValue | undefined, selectedVendor: string): boolean {
  if (!selectedVendor) return true;

  const normalized = String(rawValue ?? "")
    .split(/[|,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) return true;
  return normalized.includes(selectedVendor);
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
    deviceId: provisioningData.device?.deviceId ?? null,
    thingId,
    thingName: provisioning?.thingName ?? thingId,
    thingTypeName: provisioning?.thingTypeName ?? null,
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
  MQTT: "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]",
  HTTP: "bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]",
  CoAP: "bg-[#faf5ff] text-[#9333ea] border-[#e9d5ff]",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#dffbef] text-[#059669] border-[#98f0c5]",
  provisioning: "bg-[#fff7dd] text-[#d97706] border-[#fcd66c]",
  inactive: "bg-[#eef2f7] text-[#64748b] border-[#d8e0ea]",
};

function Badge({ value, variant = "default" }: BadgeProps) {
  let cls = "bg-gray-100 text-gray-600 border-gray-200";
  if (variant === "connection") cls = CONNECTION_COLORS[value] ?? cls;
  if (variant === "status") cls = STATUS_COLORS[value] ?? cls;
  const label = variant === "status" && value === "active" ? "Online" : variant === "status" && value === "inactive" ? "Offline" : value;
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-bold ${cls}`}
    >
      {variant === "status" ? <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" /> : null}
      {label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const STAT_TONES: Record<StatCardProps["tone"], string> = {
  slate: "bg-[#2f6df6]",
  amber: "bg-[#f59e0b]",
  emerald: "bg-[#10b981]",
  blue: "bg-[#8b5cf6]",
};

function StatCard({ label, value, sub, progress, tone }: StatCardProps) {
  return (
    <div className="inventory-kpi-card rounded-[20px] border border-[#e5ebf4] bg-white px-7 py-6 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9aa9bd]">{label}</p>
      <p className="mt-5 text-[46px] font-semibold leading-none text-[#0f172a]">{value}</p>
      <div className="mt-5 h-1.5 rounded-full bg-[#edf2f7]">
        <div
          className={`h-full rounded-full ${STAT_TONES[tone]}`}
          style={{ width: `${Math.max(8, Math.min(progress, 100))}%` }}
        />
      </div>
      <p className="mt-4 text-[14px] font-medium text-[#90a0b8]">{sub}</p>
    </div>
  );
}

function relativeUpdated(value: PrimitiveValue | undefined): string {
  if (!value) return "updated recently";
  const timestamp = new Date(String(value)).getTime();
  if (Number.isNaN(timestamp)) return "updated recently";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1w ago" : `${weeks}w ago`;
}

function DeviceIcon({ row }: { row: DeviceRow }) {
  const descriptor = `${row.itemTypeName ?? row.itemType ?? row.name ?? ""}`.toLowerCase();
  const Icon = descriptor.includes("gateway")
    ? Router
    : descriptor.includes("sensor")
      ? RadioTower
      : descriptor.includes("actuator")
        ? Cable
        : Cpu;

  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f6fb] text-[#71829a]">
      <Icon size={19} strokeWidth={2.1} />
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeviceManagementPage() {
  const [searchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
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
  const {
    rows: vendorRows,
    loading: vendorsLoading,
    createOne: createVendorOne,
  } = useCrudResource<
    VendorRow,
    Partial<VendorRow>,
    Partial<VendorRow>
  >(deviceInventoryApi.vendors, { initialRows: [] });
  const {
    rows: parameterRows,
    loading: parametersLoading,
    createOne: createParameterOne,
  } = useCrudResource<
    ParameterRow,
    Partial<ParameterRow>,
    Partial<ParameterRow>
  >(deviceInventoryApi.parameters, { initialRows: [] });
  const {
    rows: itemTypeRows,
    loading: itemTypesLoading,
    createOne: createItemTypeOne,
  } = useCrudResource<
    ItemTypeRow,
    Partial<ItemTypeRow>,
    Partial<ItemTypeRow>
  >(deviceInventoryApi.itemTypes, { initialRows: [] });
  const {
    rows: communicationRows,
    loading: communicationPoliciesLoading,
    createOne: createCommunicationOne,
  } = useCrudResource<
    CommunicationRow,
    Partial<CommunicationRow>,
    Partial<CommunicationRow>
  >(deviceInventoryApi.communications, { initialRows: [] });
  const {
    rows: messageRows,
    loading: messagesLoading,
    createOne: createMessageOne,
  } = useCrudResource<
    MessageRow,
    Partial<MessageRow>,
    Partial<MessageRow>
  >(deviceInventoryApi.messages, { initialRows: [] });
  const {
    rows: itemRows,
    createOne: createItemOne,
  } = useCrudResource<
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const visibleStart = filteredRows.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + PAGE_SIZE, filteredRows.length);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const provisioningCount = rows.filter((r) => r.status === "provisioning").length;
  const activeCount = rows.filter((r) => r.status === "active").length;
  const mqttCount = rows.filter((r) => r.connectionType === "MQTT").length;
  const totalCount = Math.max(rows.length, 1);
  const activePercent = (activeCount / totalCount) * 100;
  const provisioningPercent = (provisioningCount / totalCount) * 100;
  const mqttPercent = (mqttCount / totalCount) * 100;
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

  const selectedVendor = String(formValues.vendorName ?? "").trim().toLowerCase();
  const selectedItemType = String(formValues.itemTypeName ?? "").trim().toLowerCase();
  const selectedCommunicationPolicy = String(formValues.communicationPolicy ?? "").trim().toLowerCase();

  const itemTypeOptions = useMemo(() => {
    const values = new Set<string>();
    itemTypeRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;
      if (matchesCatalogVendor(row.vendorName, selectedVendor)) {
        values.add(name);
      }
    });
    itemRows.forEach((row) => {
      const typeName = String(row.itemType ?? "").trim();
      if (typeName && matchesCatalogVendor(row.vendor, selectedVendor)) {
        values.add(typeName);
      }
    });
    const current = String(formValues.itemTypeName ?? "").trim();
    if (current) values.add(current);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [formValues.itemTypeName, itemRows, itemTypeRows, selectedVendor]);

  const communicationPolicyOptions = useMemo(() => {
    const values = new Set<string>();
    communicationRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      const itemType = String(row.itemType ?? row.itemTypeName ?? "").trim().toLowerCase();
      const vendorName = String(row.groupName ?? "").trim().toLowerCase();
      if (
        name &&
        matchesCatalogVendor(vendorName, selectedVendor) &&
        (!selectedItemType || !itemType || itemType === selectedItemType)
      ) {
        values.add(name);
      }
    });
    itemRows.forEach((row) => {
      const name = String(row.communicationPolicy ?? "").trim();
      const itemType = String(row.itemType ?? "").trim().toLowerCase();
      if (
        name &&
        matchesCatalogVendor(row.vendor, selectedVendor) &&
        (!selectedItemType || !itemType || itemType === selectedItemType)
      ) {
        values.add(name);
      }
    });
    const current = String(formValues.communicationPolicy ?? "").trim();
    if (current) values.add(current);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [communicationRows, formValues.communicationPolicy, itemRows, selectedItemType, selectedVendor]);

  const parameterOptions = useMemo(() => {
    const values = new Set<string>();
    parameterRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;
      if (matchesCatalogVendor(row.vendors, selectedVendor)) {
        values.add(name);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [parameterRows, selectedVendor]);

  const messageOptions = useMemo(() => {
    return messageRows
      .filter((row) => {
        const rowItemType = String(row.itemType ?? "").trim().toLowerCase();
        const rowPolicy = String(row.communicationPolicy ?? "").trim().toLowerCase();

        if (selectedItemType && rowItemType && rowItemType !== selectedItemType) {
          return false;
        }

        if (
          selectedCommunicationPolicy &&
          rowPolicy &&
          rowPolicy !== selectedCommunicationPolicy
        ) {
          return false;
        }

        return true;
      })
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? row.topic ?? "Unnamed Message"),
        topic: String(row.topic ?? ""),
      }));
  }, [messageRows, selectedCommunicationPolicy, selectedItemType]);

  const itemOptions = useMemo(() => {
    return itemRows
      .filter((row) => {
        const rowVendor = String(row.vendor ?? "").trim().toLowerCase();
        const rowItemType = String(row.itemType ?? "").trim().toLowerCase();
        const rowPolicy = String(row.communicationPolicy ?? "").trim().toLowerCase();

        if (!matchesCatalogVendor(row.vendor, selectedVendor)) {
          return false;
        }

        if (selectedItemType && rowItemType && rowItemType !== selectedItemType) {
          return false;
        }

        if (
          selectedCommunicationPolicy &&
          rowPolicy &&
          rowPolicy !== selectedCommunicationPolicy
        ) {
          return false;
        }

        return !selectedVendor || !rowVendor || rowVendor === selectedVendor || matchesCatalogVendor(row.vendor, selectedVendor);
      })
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        itemCode: String(row.itemCode ?? ""),
        vendor: String(row.vendor ?? ""),
        itemType: String(row.itemType ?? ""),
        communicationPolicy: String(row.communicationPolicy ?? ""),
      }));
  }, [itemRows, selectedCommunicationPolicy, selectedItemType, selectedVendor]);

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
    const generatedSuffix = generateProvisioningUuid().slice(0, 8);
    const name =
      String(formValues.name ?? "").trim() ||
      String(formValues.itemName ?? "").trim() ||
      `device-${generatedSuffix}`;
    const serialNumber =
      String(formValues.serialNumber ?? "").trim() ||
      String(formValues.foreignId ?? "").trim() ||
      `AUTO-${generateProvisioningUuid().slice(0, 12).toUpperCase()}`;
    const connectionType = String(formValues.connectionType ?? "").trim() || "MQTT";
    const project = String(formValues.project ?? "").trim() || "project_a";

    setSubmitError(null);
    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      if (editingId !== null) {
        await updateOne(editingId, {
          ...formValues,
          name,
          serialNumber,
          connectionType,
          project,
          metadata: buildCatalogMetadata(
            formValues,
            readStringFromUnknown(formValues.foreignId) ??
              readStringFromUnknown(formValues.serialNumber) ??
              generateProvisioningUuid()
          ),
          updatedAt: now,
        });
      } else {
        const provisionDeviceType = "SINGLE";
        const provisionDeviceId = `dev-${generateProvisioningUuid()}`;
        const thingName = `thing-${generateProvisioningUuid()}`;
        const catalogMetadata = buildCatalogMetadata(formValues, thingName);
        const provisioningConfig = parseProvisioningConfig(catalogMetadata, {
          name,
          project,
          connectionType,
          fallbackThingName: thingName,
        });
        const effectiveDeviceType = provisioningConfig.deviceType ?? provisionDeviceType;
        const provisioningData = await deviceInventoryApi.iot.provisionThing({
          ...provisioningConfig,
          deviceId: provisioningConfig.deviceId ?? provisionDeviceId,
          deviceType: effectiveDeviceType,
          thingName: provisioningConfig.thingName ?? thingName,
          thingTypeName: generateThingTypeName(effectiveDeviceType),
        });

        const thingId =
          provisioningData.device?.thingId ??
          provisioningData.provisioning?.thingName ??
          thingName;

        const created = await createOne({
          ...formValues,
          name,
          serialNumber,
          connectionType,
          project,
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
        next.parameterName = "";
        next.itemTypeName = "";
        next.communicationPolicy = "";
        next.messageName = "";
        next.itemName = "";
        next.itemCode = "";
      }

      if (key === "itemTypeName") {
        next.communicationPolicy = "";
        next.messageName = "";
        next.itemName = "";
        next.itemCode = "";
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
        next.messageName = "";
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
    if (col.key === "name") {
      const description =
        String(row.itemTypeName ?? row.itemType ?? "").trim() ||
        String(row.project ?? "").trim() ||
        "Controller";
      const location =
        String(row.site ?? row.location ?? row.vendorName ?? "").trim() ||
        String(row.project ?? "").trim() ||
        "Plant fleet";

      return (
        <div className="flex min-w-[260px] items-center gap-4">
          <DeviceIcon row={row} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-black leading-5 tracking-[-0.015em] text-[#111827]">
              {display}
            </p>
            <p className="mt-1 truncate text-[14px] font-semibold leading-4 text-[#94a3b8]">
              {description} - {location}
            </p>
          </div>
        </div>
      );
    }
    if (col.key === "updatedAt") {
      return (
        <div className="min-w-[120px]">
          <p className="text-[15px] font-bold text-[#334155]">{display}</p>
          <p className="mt-1 text-[13px] font-semibold text-[#9aa9bd]">{relativeUpdated(row.updatedAt)}</p>
        </div>
      );
    }
    return (
      <span
        className={`text-[13px] ${
          col.key === "serialNumber"
            ? "font-mono text-[15px] font-medium text-[#64748b]"
            : "font-semibold text-[#64748b]"
        }`}
      >
        {display}
      </span>
    );
  };

  return (
    <div
      className="inventory-page-theme min-h-screen w-full bg-[#f5f8fc]"
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

      <div className="border-b border-[#e5ebf4] bg-[#f5f8fc] px-6 py-8 md:px-10 lg:px-12">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#2f6df6]">
              IOTIQ Platform - Device Inventory
            </p>
            <h1 className="mt-4 text-[40px] font-semibold leading-none text-[#111827] md:text-[44px]">
              Device Management
            </h1>
            <p className="mt-5 text-[18px] font-medium leading-7 text-[#7c8ba1]">
              Review enrolled devices, assigned sites, and lifecycle status across the fleet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-16 min-w-[150px] items-center gap-4">
              <Wifi size={28} strokeWidth={2.6} className="text-[#10b981]" />
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#8797af]">Fleet</p>
                <p className="text-[18px] font-bold leading-5 text-[#0f172a]">Connected</p>
              </div>
            </div>
            <div className="flex h-16 min-w-[150px] items-center gap-4">
              <ShieldCheck size={28} strokeWidth={2.6} className="text-[#2f6df6]" />
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#8797af]">Policy</p>
                <p className="text-[18px] font-bold leading-5 text-[#0f172a]">Protected</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (formOpen) {
                  handleCancel();
                  return;
                }
                openCreate();
              }}
              className={`flex h-16 min-w-[168px] items-center justify-center gap-3 rounded-xl px-5 text-[16px] font-semibold leading-5 transition active:scale-95 ${
                formOpen
                  ? "text-[#334155] hover:bg-[#eef2f7]"
                  : "bg-[#0f172a] text-white hover:bg-[#1e293b]"
              }`}
            >
              {formOpen ? (
                <><X size={20} strokeWidth={2.4} />Close</>
              ) : (
                <><Plus size={24} strokeWidth={2.6} />Add Device</>
              )}
            </button>
          </div>
        </div>
      </div>

      {formOpen ? (
        <DeviceWorkflowBuilder
          title={editingId ? "Edit Device Workflow" : "Create Device Workflow"}
          subtitle="Choose catalog components in order, add missing records with +, and then create the device."
          values={formValues}
          onValueChange={handleValueChange}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSaving={isSaving}
          editing={editingId !== null}
          submitError={submitError}
          vendorsLoading={vendorsLoading}
          parametersLoading={parametersLoading}
          itemTypesLoading={itemTypesLoading}
          communicationPoliciesLoading={communicationPoliciesLoading}
          messagesLoading={messagesLoading}
          vendorOptions={vendorOptions}
          vendorRows={vendorRows}
          parameterOptions={parameterOptions}
          itemTypeOptions={itemTypeOptions}
          communicationPolicyOptions={communicationPolicyOptions}
          messageOptions={messageOptions}
          itemOptions={itemOptions}
          onCreateVendor={async (payload) => {
            await createVendorOne(payload as Partial<VendorRow>);
          }}
          onCreateParameter={async (payload) => {
            await createParameterOne(payload as Partial<ParameterRow>);
          }}
          onCreateItemType={async (payload) => {
            await createItemTypeOne(payload as Partial<ItemTypeRow>);
          }}
          onCreateCommunication={async (payload) => {
            await createCommunicationOne(payload as Partial<CommunicationRow>);
          }}
          onCreateMessage={async (payload) => {
            await createMessageOne(payload as Partial<MessageRow>);
          }}
          onCreateItem={async (payload) => {
            await createItemOne(payload as Partial<ItemRow>);
          }}
        />
      ) : (
      <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-5 px-6 py-8 md:grid-cols-2 md:px-10 lg:grid-cols-4 lg:px-12">
        <StatCard label="Total Devices" value={String(rows.length)} sub="all registered devices" progress={100} tone="slate" />
        <StatCard label="Provisioning" value={String(provisioningCount)} sub="awaiting activation" progress={provisioningPercent} tone="amber" />
        <StatCard label="Active" value={String(activeCount)} sub="currently online" progress={activePercent} tone="emerald" />
        <StatCard label="MQTT" value={String(mqttCount)} sub="using MQTT protocol" progress={mqttPercent} tone="blue" />
      </div>
      {error && (
        <div className="px-6 md:px-10 lg:px-12">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        </div>
      )}
      {submitError && (
        <div className="mt-4 px-6 md:px-10 lg:px-12">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {submitError}
          </p>
        </div>
      )}
      {loading && (
        <div className="mt-4 px-6 md:px-10 lg:px-12">
          <p className="text-[12px] text-slate-500">Loading devices...</p>
        </div>
      )}

      {/* Main split layout */}
      <div className="flex items-start gap-6 px-6 pb-12 md:px-10 lg:px-12">

        {/* Table column */}
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_224px_240px_auto]">
            <div className="relative min-w-0">
              <Search size={24} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[#8ea0b8]" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search devices, serials, sites..."
                className="h-[62px] w-full rounded-2xl border border-[#dbe4ef] bg-white pl-16 pr-12 text-[19px] font-medium text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-[#94a3b8] focus:border-[#93b4ff] focus:ring-4 focus:ring-[#dbeafe]"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#8ea0b8] transition hover:text-[#334155]">
                  <X size={18} />
                </button>
              )}
            </div>

            {FILTERS.map((f) => (
              <div key={f.key} className="relative">
                <select
                  value={filters[f.key]}
                  onChange={(e) => setFilters((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="h-[56px] w-full cursor-pointer appearance-none rounded-2xl border border-[#dbe4ef] bg-white pl-5 pr-11 text-[16px] font-bold text-[#64748b] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition focus:border-[#93b4ff] focus:ring-4 focus:ring-[#dbeafe]"
                >
                  <option value="all">{f.label === "Type" ? "Type  All Types" : "Status  All Statuses"}</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#8ea0b8]" />
              </div>
            ))}

            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#dbe4ef] bg-white px-5 text-[14px] font-bold text-[#64748b] shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-[#cbd5e1] hover:text-[#334155]">
                <RotateCcw size={16} />
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-[20px] border border-[#e5ebf4] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="border-b border-[#e5ebf4] px-7 py-5">
              <p className="text-[18px] font-black text-[#111827]">
                {filteredRows.length} device{filteredRows.length !== 1 ? "s" : ""} <span className="font-bold text-[#9aa9bd]">- sorted by updated</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e5ebf4] bg-white">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="whitespace-nowrap px-7 py-4 text-left text-[12px] font-black uppercase tracking-[0.14em] text-[#9aa9bd]">
                        {col.label} {col.key === "updatedAt" ? <ChevronDown size={14} className="ml-1 inline text-[#111827]" /> : <span className="text-[#cbd5e1]">^</span>}
                      </th>
                    ))}
                    <th className="px-7 py-4 text-right text-[12px] font-black uppercase tracking-[0.14em] text-[#9aa9bd]">Actions</th>
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
                    paginatedRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => openDetails(row)}
                        className={`cursor-pointer border-b border-[#edf2f7] last:border-0 transition-colors hover:bg-[#f8fbff] ${editingId === row.id ? "bg-[#eff6ff]" : ""}`}
                      >
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="whitespace-nowrap px-7 py-5">
                            {resolveCell(col, row)}
                          </td>
                        ))}
                        <td className="px-7 py-5">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(row);
                              }}
                              className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-[0_6px_14px_rgba(47,109,246,0.10)] transition-colors ${
                                editingId === row.id
                                  ? "border-[#93c5fd] bg-[#dbeafe] text-[#2563eb]"
                                  : "border-[#bfdbfe] bg-[#eff6ff] text-[#2f6df6] hover:border-[#2f6df6] hover:bg-[#dbeafe]"
                              }`}
                              aria-label="Edit device"
                            >
                              <Pencil size={18} strokeWidth={2.2} />
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
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#fecaca] bg-[#fff7f7] text-[#ef4444] shadow-[0_6px_14px_rgba(239,68,68,0.10)] transition-colors hover:border-[#ef4444] hover:bg-[#fff1f2]"
                                aria-label="Delete device"
                              >
                                <Trash2 size={18} strokeWidth={2.2} />
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
            <div className="flex flex-col gap-4 border-t border-[#cbd5e1] bg-[#eef4fb] px-7 py-5 text-[12px] font-bold text-[#475569] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] md:flex-row md:items-center md:justify-between">
              <span>{filteredRows.length} device{filteredRows.length !== 1 ? "s" : ""}</span>
              <div className="flex flex-wrap items-center gap-3">
                <span>{filteredRows.length === 0 ? "0 results" : `${visibleStart}-${visibleEnd} of ${filteredRows.length}`}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:border-[#2f6df6] hover:text-[#2f6df6] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8] disabled:shadow-none disabled:hover:border-[#cbd5e1] disabled:hover:text-[#94a3b8]"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} strokeWidth={2.4} />
                  </button>
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-9 min-w-9 rounded-xl px-3 text-[12px] font-bold transition ${
                        currentPage === pageNumber
                          ? "bg-[#0f172a] text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]"
                          : "border border-[#cbd5e1] bg-white text-[#334155] shadow-[0_6px_14px_rgba(15,23,42,0.08)] hover:border-[#2f6df6] hover:text-[#2f6df6]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:border-[#2f6df6] hover:text-[#2f6df6] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8] disabled:shadow-none disabled:hover:border-[#cbd5e1] disabled:hover:text-[#94a3b8]"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      <RightDrawer
        open={Boolean(selectedDevice)}
        onClose={() => setSelectedDeviceId(null)}
        size="large"
      >
        {selectedDevice ? (
          <DeviceDetailsView
            device={selectedDevice}
            onBack={() => setSelectedDeviceId(null)}
            onEdit={() => openEdit(selectedDevice)}
          />
        ) : null}
      </RightDrawer>
    </div>
  );
}





