import { useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Boxes,
  Cable,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Layers3,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { RightDrawer } from "../management/ui";

type PrimitiveValue = string | number | boolean | null;

type WorkflowNode =
  | "vendor"
  | "parameter"
  | "itemType"
  | "communication"
  | "message"
  | "item"
  | "device";

type OptionItem = {
  id: string;
  name: string;
  topic?: string;
};

type ItemOption = {
  id: string;
  name: string;
  itemCode: string;
  vendor: string;
  itemType: string;
  communicationPolicy: string;
};

type VendorRowLike = Record<string, PrimitiveValue>;

interface DeviceWorkflowBuilderProps {
  title: string;
  subtitle: string;
  values: Record<string, PrimitiveValue>;
  editing: boolean;
  isSaving: boolean;
  submitError?: string | null;
  vendorsLoading?: boolean;
  parametersLoading?: boolean;
  itemTypesLoading?: boolean;
  communicationPoliciesLoading?: boolean;
  messagesLoading?: boolean;
  vendorOptions: string[];
  vendorRows?: VendorRowLike[];
  parameterOptions: string[];
  itemTypeOptions: string[];
  communicationPolicyOptions: string[];
  messageOptions: OptionItem[];
  itemOptions: ItemOption[];
  onValueChange: (key: string, value: PrimitiveValue) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onCreateVendor: (payload: Record<string, unknown>) => Promise<void>;
  onCreateParameter: (payload: Record<string, unknown>) => Promise<void>;
  onCreateItemType: (payload: Record<string, unknown>) => Promise<void>;
  onCreateCommunication: (payload: Record<string, unknown>) => Promise<void>;
  onCreateMessage: (payload: Record<string, unknown>) => Promise<void>;
  onCreateItem: (payload: Record<string, unknown>) => Promise<void>;
}

type DrawerMode = "select" | "create";

type DrawerFormState = {
  name: string;
  description: string;
  synonyms: string;
  variableType: string;
  pinType: string;
  vendorName: string;
  parameterName: string;
  topic: string;
  groupName: string;
  messageFormat: string;
  centric: string;
  iconName: string;
  communicationMethod: string;
  commandType: string;
  policyType: string;
  requestPayloadFormat: string;
  responsePayloadFormat: string;
  itemCode: string;
  metadata: string;
  itemPollingConfig: string;
  tags: string;
  gateway: string;
  componentCount: string;
  secureItem: boolean;
  serialNumber: string;
  connectionType: string;
  project: string;
  vendorCode: string;
  protocol: string;
  clientId: string;
  clientSecret: string;
  uid: string;
  apiBaseUrl: string;
  mqttEndpoint: string;
  authType: string;
  tokenUrl: string;
  status: string;
  notes: string;
};

type VendorListItem = {
  id: string;
  name: string;
  vendorCode: string;
  status: string;
  protocol?: string;
  authType: string;
  description: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
};

type ActiveOption = {
  id: string;
  label: string;
  meta?: string;
  detail?: string;
  status?: string;
};

function readString(value: PrimitiveValue | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function deriveVendorCode(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact) return compact.slice(0, 8);
  return "VENDOR";
}

function makeEmptyState() {
  return {
    name: "",
    description: "",
    synonyms: "",
    variableType: "string",
    pinType: "",
    vendorName: "",
    parameterName: "",
    topic: "mqtt/device/{{thingName}}/control",
    groupName: "",
    messageFormat: "JSON",
    centric: "TOPIC",
    iconName: "radio",
    communicationMethod: "PUBLISH",
    commandType: "POST",
    policyType: "EXECUTE",
    requestPayloadFormat: '{\n  "deviceid": "{{connectAdminDeviceId}}"\n}',
    responsePayloadFormat: '{\n  "success": true\n}',
    itemCode: "",
    metadata: "{}",
    itemPollingConfig: "{}",
    tags: "",
    gateway: "",
    componentCount: "",
    secureItem: false,
    serialNumber: "",
    connectionType: "MQTT",
    project: "project_a",
    vendorCode: "",
    protocol: "API",
    clientId: "",
    clientSecret: "",
    uid: "",
    apiBaseUrl: "",
    mqttEndpoint: "",
    authType: "OAUTH2",
    tokenUrl: "",
    status: "active",
    notes: "",
  };
}

const NODES: Array<{
  key: WorkflowNode;
  title: string;
  bindsTo: string | null;
  icon: typeof BadgeCheck;
  accent: string;
  panelTitle: string;
  helper: string;
}> = [
  {
    key: "vendor",
    title: "Vendor",
    bindsTo: "vendorName",
    icon: ShieldCheck,
    accent: "bg-[#f4f8f0] text-[#648d4f] border-[#dce9d5]",
    panelTitle: "Vendor library",
    helper: "Select or register the vendor profile that owns protocol and credential context.",
  },
  {
    key: "parameter",
    title: "Parameter",
    bindsTo: "parameterName",
    icon: SlidersHorizontal,
    accent: "bg-[#f8f7ef] text-[#8e6b20] border-[#eadfbf]",
    panelTitle: "Parameter library",
    helper: "Choose the parameter definition that will be wired into this device template.",
  },
  {
    key: "itemType",
    title: "Item Type",
    bindsTo: "itemTypeName",
    icon: Layers3,
    accent: "bg-[#f5f4fb] text-[#6a59a2] border-[#ddd7ef]",
    panelTitle: "Item type library",
    helper: "Pick the device family or hardware type for this workflow.",
  },
  {
    key: "communication",
    title: "Communication",
    bindsTo: "communicationPolicy",
    icon: Cable,
    accent: "bg-[#f7f8f2] text-[#4f6d40] border-[#dde4d2]",
    panelTitle: "Communication policy",
    helper: "Assign the protocol transport and message centric rules.",
  },
  {
    key: "message",
    title: "Message",
    bindsTo: "messageName",
    icon: MessagesSquare,
    accent: "bg-[#fbf6ef] text-[#9b5d2d] border-[#f0dece]",
    panelTitle: "Message catalog",
    helper: "Choose the command or telemetry message template to wire into this device.",
  },
  {
    key: "item",
    title: "Item",
    bindsTo: "itemName",
    icon: Boxes,
    accent: "bg-[#f2f8f6] text-[#336c55] border-[#d8ebe4]",
    panelTitle: "Item catalog",
    helper: "Bind the reusable item profile that connects vendor, type, and policy.",
  },
  {
    key: "device",
    title: "Device",
    bindsTo: "name",
    icon: Cpu,
    accent: "bg-[#f5f7fb] text-[#3b5f8a] border-[#dbe4f0]",
    panelTitle: "Device configuration",
    helper: "Set the runtime identity that will be provisioned through the onboarding flow.",
  },
];

function NodeIconBadge({
  icon: Icon,
  accent,
}: {
  icon: typeof BadgeCheck;
  accent: string;
}) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${accent}`}>
      <Icon size={17} />
    </span>
  );
}

function VendorAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e4ead8] bg-[#f7f8f2] text-[12px] font-semibold text-[#506246]">
      {initials || "VN"}
    </span>
  );
}

function Field({
  label,
  required,
  children,
  helper,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  helper?: string;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--iotiq-text)]">
        <span>{label}</span>
        {required ? <span className="text-[#c46951]">*</span> : null}
      </div>
      {children}
      {helper ? <p className="text-[10px] text-[var(--iotiq-muted)]">{helper}</p> : null}
    </label>
  );
}

function inputClass(multiline = false) {
  return multiline
    ? "w-full rounded-2xl border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2.5 text-[12px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]"
    : "h-10 w-full rounded-2xl border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[12px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]";
}

export default function DeviceWorkflowBuilder({
  title,
  subtitle,
  values,
  editing,
  isSaving,
  submitError,
  vendorsLoading = false,
  parametersLoading = false,
  itemTypesLoading = false,
  communicationPoliciesLoading = false,
  messagesLoading = false,
  vendorOptions,
  vendorRows = [],
  parameterOptions,
  itemTypeOptions,
  communicationPolicyOptions,
  messageOptions,
  itemOptions,
  onValueChange,
  onSubmit,
  onCancel,
  onCreateVendor,
  onCreateParameter,
  onCreateItemType,
  onCreateCommunication,
  onCreateMessage,
  onCreateItem,
}: DeviceWorkflowBuilderProps) {
  const [activeNode, setActiveNode] = useState<WorkflowNode | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [formState, setFormState] = useState<DrawerFormState>(makeEmptyState());

  const activeConfig = NODES.find((node) => node.key === activeNode) ?? null;

  const vendorList = useMemo<VendorListItem[]>(() => {
    const seen = new Set<string>();
    const rows = vendorRows.reduce<VendorListItem[]>((collection, row) => {
        const name = readString(row.name || row.vendorName);
        if (!name) return collection;

        collection.push({
          id: readString(row.id) || name,
          name,
          vendorCode: readString((row as Record<string, PrimitiveValue>).vendorCode) || deriveVendorCode(name),
          status: readString((row as Record<string, PrimitiveValue>).status) || "active",
          protocol: readString((row as Record<string, PrimitiveValue>).protocol) || undefined,
          authType: readString(row.authType) || "Configured",
          description: readString(row.description),
          clientId: readString(row.clientId) || undefined,
          clientSecret: readString(row.clientSecret) || undefined,
          tokenUrl: readString(row.tokenUrl) || undefined,
        });

        return collection;
      }, [])
      .filter((entry) => {
        const uniqueKey = entry.name.toLowerCase();
        if (seen.has(uniqueKey)) return false;
        seen.add(uniqueKey);
        return true;
      });

    vendorOptions.forEach((name) => {
      const trimmed = name.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      rows.push({
        id: trimmed,
        name: trimmed,
        vendorCode: deriveVendorCode(trimmed),
        status: "active",
        protocol: "API",
        authType: "Configured",
        description: "",
      });
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [vendorOptions, vendorRows]);

  const activeOptions = useMemo<ActiveOption[]>(() => {
    if (!activeNode) return [];
    if (activeNode === "vendor") {
      return vendorList.map((entry) => ({
        id: entry.id,
        label: entry.name,
        meta: entry.vendorCode,
        detail: [entry.protocol, entry.authType].filter(Boolean).join(" • "),
        status: entry.status,
      }));
    }

    if (activeNode === "parameter") {
      return parameterOptions.map((name) => ({ id: name, label: name }));
    }

    if (activeNode === "itemType") {
      return itemTypeOptions.map((name) => ({ id: name, label: name }));
    }

    if (activeNode === "communication") {
      return communicationPolicyOptions.map((name) => ({ id: name, label: name }));
    }

    if (activeNode === "message") {
      return messageOptions.map((entry) => ({
        id: entry.id,
        label: entry.name,
        meta: entry.topic,
      }));
    }

    if (activeNode === "item") {
      return itemOptions.map((entry) => ({
        id: entry.id,
        label: entry.name,
        meta: entry.itemCode,
        detail: [entry.vendor, entry.itemType].filter(Boolean).join(" • "),
      }));
    }

    return [];
  }, [
    activeNode,
    communicationPolicyOptions,
    itemOptions,
    itemTypeOptions,
    messageOptions,
    parameterOptions,
    vendorList,
  ]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeOptions;

    return activeOptions.filter((entry) =>
      [entry.label, entry.meta, entry.detail, entry.status].some((value) =>
        value?.toLowerCase().includes(q)
      )
    );
  }, [activeOptions, searchQuery]);

  const activeLoading =
    (activeNode === "vendor" && vendorsLoading) ||
    (activeNode === "parameter" && parametersLoading) ||
    (activeNode === "itemType" && itemTypesLoading) ||
    (activeNode === "communication" && communicationPoliciesLoading) ||
    (activeNode === "message" && messagesLoading);

  const deviceSummary = useMemo(() => {
    const pieces = [
      readString(values.name),
      readString(values.serialNumber),
      readString(values.connectionType),
      readString(values.project),
    ].filter(Boolean);
    return pieces.join(" • ");
  }, [values.connectionType, values.name, values.project, values.serialNumber]);

  const openDrawer = (node: WorkflowNode, mode: DrawerMode = "select") => {
    setActiveNode(node);
    setDrawerMode(mode);
    setDrawerError(null);
    setSearchQuery("");
    setShowClientSecret(false);
      setFormState({
        ...makeEmptyState(),
        name:
        node === "item"
          ? readString(values.itemName)
          : node === "device"
            ? readString(values.name)
            : "",
        itemCode: node === "item" ? readString(values.itemCode) : "",
        metadata: node === "item" ? readString(values.metadata) || "{}" : "{}",
        itemPollingConfig: node === "item" ? readString(values.itemPollingConfig) || "{}" : "{}",
        tags: node === "item" ? readString(values.tags) : "",
        gateway: node === "item" ? readString(values.gateway) : "",
        componentCount: node === "item" ? readString(values.componentCount) : "",
        secureItem: node === "item" ? String(values.secureItem) === "true" : false,
        serialNumber: node === "device" ? readString(values.serialNumber) : "",
        connectionType: node === "device" ? readString(values.connectionType) || "MQTT" : "MQTT",
        project: node === "device" ? readString(values.project) || "project_a" : "project_a",
        groupName: readString(values.vendorName) || "",
        vendorName: readString(values.vendorName) || "",
        parameterName: readString(values.parameterName) || "",
        synonyms: node === "itemType" ? readString(values.synonyms) : "",
        vendorCode: node === "vendor" ? deriveVendorCode(readString(values.vendorName) || "Vendor") : "",
        protocol: "API",
        authType: "OAUTH2",
        status: "active",
      });
  };

  const closeDrawer = () => {
    setActiveNode(null);
    setDrawerError(null);
    setDrawerSaving(false);
    setSearchQuery("");
    setShowClientSecret(false);
  };

  const selectOption = (value: string) => {
    if (!activeNode) return;

    if (activeNode === "vendor") onValueChange("vendorName", value);
    if (activeNode === "parameter") onValueChange("parameterName", value);
    if (activeNode === "itemType") onValueChange("itemTypeName", value);
    if (activeNode === "communication") onValueChange("communicationPolicy", value);
    if (activeNode === "message") onValueChange("messageName", value);

    if (activeNode === "item") {
      const selected = itemOptions.find((entry) => entry.name === value);
      if (selected) {
        onValueChange("itemName", selected.name);
        onValueChange("itemCode", selected.itemCode);
        if (selected.vendor) onValueChange("vendorName", selected.vendor);
        if (selected.itemType) onValueChange("itemTypeName", selected.itemType);
        if (selected.communicationPolicy) onValueChange("communicationPolicy", selected.communicationPolicy);
      }
    }

    closeDrawer();
  };

  const createNodeRecord = async () => {
    if (!activeNode) return;

    if (activeNode === "device") {
      const name = formState.name.trim();
      const serialNumber = formState.serialNumber.trim();
      const connectionType = formState.connectionType.trim();
      const project = formState.project.trim();

      if (!name || !serialNumber || !connectionType || !project) {
        setDrawerError("Device name, serial number, connection type, and project are required.");
        return;
      }

      onValueChange("name", name);
      onValueChange("serialNumber", serialNumber);
      onValueChange("connectionType", connectionType);
      onValueChange("project", project);
      closeDrawer();
      return;
    }

    const name = formState.name.trim();
    if (!name) {
      setDrawerError("Name is required.");
      return;
    }

    setDrawerSaving(true);
    setDrawerError(null);

    try {
      if (activeNode === "vendor") {
        await onCreateVendor({
          name,
          description: formState.description.trim() || undefined,
          protocol: formState.protocol.trim() || undefined,
          baseUrl: formState.apiBaseUrl.trim() || undefined,
          authType: formState.authType.trim() || undefined,
          clientId: formState.clientId.trim() || undefined,
          clientSecret: formState.clientSecret.trim() || undefined,
          tokenUrl: formState.tokenUrl.trim() || undefined,
          vendorCode: formState.vendorCode.trim() || undefined,
          uid: formState.uid.trim() || undefined,
          mqttEndpoint: formState.mqttEndpoint.trim() || undefined,
          status: formState.status.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        });
        onValueChange("vendorName", name);
      }

      if (activeNode === "parameter") {
        await onCreateParameter({
          name,
          vendors: readString(values.vendorName) || undefined,
          variableType: formState.variableType.trim() || "string",
          pinType: formState.pinType.trim() || undefined,
        });
        onValueChange("parameterName", name);
      }

      if (activeNode === "itemType") {
        await onCreateItemType({
          name,
          description: formState.description.trim() || undefined,
          synonyms: formState.synonyms.trim() || undefined,
          vendorName: formState.vendorName.trim() || readString(values.vendorName) || undefined,
        });
        onValueChange("itemTypeName", name);
      }

      if (activeNode === "communication") {
        await onCreateCommunication({
          name,
          groupName: formState.groupName.trim() || readString(values.vendorName) || "default",
          itemType: readString(values.itemTypeName) || "generic",
          protocol: formState.protocol.trim() || "MQTT",
          messageFormat: formState.messageFormat.trim() || "JSON",
          centric: formState.centric.trim() || "TOPIC",
          communicationMethod: formState.communicationMethod.trim() || undefined,
          icon: formState.iconName.trim() || "radio",
          messageStructure: formState.requestPayloadFormat.trim() || undefined,
          confirmationMessageStructure: formState.responsePayloadFormat.trim() || undefined,
        });
        onValueChange("communicationPolicy", name);
      }

      if (activeNode === "message") {
        const itemType = readString(values.itemTypeName);
        const communicationPolicy = readString(values.communicationPolicy);
        if (!itemType || !communicationPolicy) {
          throw new Error("Select item type and communication policy before creating a message.");
        }
        await onCreateMessage({
          name,
          itemType,
          communicationPolicy,
          topic: formState.topic.trim() || "mqtt/device/{{thingName}}/control",
          messageType: formState.messageFormat.trim() || "UPDATE",
          commandType: formState.commandType.trim() || "POST",
          policyType: formState.policyType.trim() || "EXECUTE",
          communicationMethod: formState.communicationMethod.trim() || "PUBLISH",
          requestPayloadFormat: formState.requestPayloadFormat.trim() || undefined,
          responsePayloadFormat: formState.responsePayloadFormat.trim() || undefined,
          payloadFormat: formState.requestPayloadFormat.trim() || undefined,
          confirmationPayloadFormat: formState.responsePayloadFormat.trim() || undefined,
          notes: formState.description.trim() || undefined,
        });
        onValueChange("messageName", name);
      }

      if (activeNode === "item") {
        const vendor = readString(values.vendorName);
        const itemType = readString(values.itemTypeName);
        const communicationPolicy = readString(values.communicationPolicy);
        if (!vendor || !itemType || !communicationPolicy) {
          throw new Error("Select vendor, item type, and communication policy before creating an item.");
        }
        const itemCode = formState.itemCode.trim() || name.replace(/\s+/g, "_").toUpperCase();
        await onCreateItem({
          name,
          itemCode,
          vendor,
          itemType,
          communicationPolicy,
          description: formState.description.trim() || undefined,
          metadata: formState.metadata.trim() || undefined,
          itemPollingConfig: formState.itemPollingConfig.trim() || undefined,
          gateway: formState.gateway.trim() || undefined,
          icon: formState.iconName.trim() || undefined,
          tags: formState.tags.trim() || undefined,
          componentCount: formState.componentCount.trim() ? Number(formState.componentCount) : undefined,
          secureItem: formState.secureItem,
        });
        onValueChange("itemName", name);
        onValueChange("itemCode", itemCode);
      }

      closeDrawer();
    } catch (error) {
      setDrawerError(error instanceof Error ? error.message : "Unable to create record");
    } finally {
      setDrawerSaving(false);
    }
  };

  const renderNodeValue = (node: (typeof NODES)[number]) => {
    if (node.key === "device") return deviceSummary || "Not selected";
    return readString(node.bindsTo ? values[node.bindsTo] : null) || "Not selected";
  };

  const completedCount = NODES.filter((node) => renderNodeValue(node) !== "Not selected").length;

  const copyClientSecret = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(formState.clientSecret);
  };

  const renderVendorCreateForm = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor name" required>
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            className={inputClass()}
            placeholder="ELEVATE Systems"
          />
        </Field>
        <Field label="Vendor code">
          <input
            value={formState.vendorCode}
            onChange={(event) => setFormState((current) => ({ ...current, vendorCode: event.target.value }))}
            className={inputClass()}
            placeholder="ELVT01"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Protocol" required helper="Tuya-style cloud integrations should usually use API.">
          <select
            value={formState.protocol}
            onChange={(event) => setFormState((current) => ({ ...current, protocol: event.target.value }))}
            className={inputClass()}
          >
            <option value="API">API</option>
            <option value="HTTP">HTTP</option>
            <option value="MQTT">MQTT</option>
            <option value="WEBSOCKET">WEBSOCKET</option>
            <option value="ZIGBEE">ZIGBEE</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client ID">
          <input
            value={formState.clientId}
            onChange={(event) => setFormState((current) => ({ ...current, clientId: event.target.value }))}
            className={inputClass()}
            placeholder="client-app-id"
          />
        </Field>
        <Field label="UID">
          <input
            value={formState.uid}
            onChange={(event) => setFormState((current) => ({ ...current, uid: event.target.value }))}
            className={inputClass()}
            placeholder="vendor-uid"
          />
        </Field>
      </div>

      <Field label="Client secret">
        <div className="relative">
          <input
            type={showClientSecret ? "text" : "password"}
            value={formState.clientSecret}
            onChange={(event) => setFormState((current) => ({ ...current, clientSecret: event.target.value }))}
            className={`${inputClass()} pr-20`}
            placeholder="Protected secret"
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowClientSecret((current) => !current)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7b8076] transition hover:bg-white"
              aria-label={showClientSecret ? "Hide client secret" : "Show client secret"}
            >
              {showClientSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              onClick={() => void copyClientSecret()}
              disabled={!formState.clientSecret.trim()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7b8076] transition hover:bg-white disabled:opacity-35"
              aria-label="Copy client secret"
            >
              <Copy size={13} />
            </button>
          </div>
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="API base URL">
          <input
            value={formState.apiBaseUrl}
            onChange={(event) => setFormState((current) => ({ ...current, apiBaseUrl: event.target.value }))}
            className={inputClass()}
            placeholder="https://api.vendor.com"
          />
        </Field>
        <Field label="MQTT endpoint">
          <input
            value={formState.mqttEndpoint}
            onChange={(event) => setFormState((current) => ({ ...current, mqttEndpoint: event.target.value }))}
            className={inputClass()}
            placeholder="mqtt.vendor.com"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Auth type">
          <select
            value={formState.authType}
            onChange={(event) => setFormState((current) => ({ ...current, authType: event.target.value }))}
            className={inputClass()}
          >
            <option value="OAUTH2">OAUTH2</option>
            <option value="Credentials">Credentials</option>
            <option value="JWT">JWT</option>
            <option value="Certificate">Certificate</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            value={formState.status}
            onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
            className={inputClass()}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
      </div>

      <Field label="Token URL">
        <input
          value={formState.tokenUrl}
          onChange={(event) => setFormState((current) => ({ ...current, tokenUrl: event.target.value }))}
          className={inputClass()}
          placeholder="https://auth.vendor.com/token"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={formState.description}
          onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
          className={inputClass(true)}
          rows={3}
          placeholder="Short vendor summary"
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={formState.notes}
          onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          className={inputClass(true)}
          rows={3}
          placeholder="Operational notes or onboarding reminders"
        />
      </Field>
    </div>
  );

  const renderGenericCreateForm = () => {
    if (!activeNode) return null;

    if (activeNode === "device") {
      return (
        <div className="space-y-4">
          <Field label="Device name" required>
            <input
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              className={inputClass()}
              placeholder="Turbo Controller 01"
            />
          </Field>
          <Field label="Serial number" required>
            <input
              value={formState.serialNumber}
              onChange={(event) => setFormState((current) => ({ ...current, serialNumber: event.target.value }))}
              className={inputClass()}
              placeholder="IOTIQDC2_A1025048"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Connection type" required>
              <select
                value={formState.connectionType}
                onChange={(event) => setFormState((current) => ({ ...current, connectionType: event.target.value }))}
                className={inputClass()}
              >
                <option value="MQTT">MQTT</option>
                <option value="API">API</option>
                <option value="WEBSOCKET">WEBSOCKET</option>
                <option value="WIFI">WIFI</option>
              </select>
            </Field>
            <Field label="Project" required>
              <input
                value={formState.project}
                onChange={(event) => setFormState((current) => ({ ...current, project: event.target.value }))}
                className={inputClass()}
                placeholder="project_a"
              />
            </Field>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Field label="Name" required>
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            className={inputClass()}
            placeholder="Enter name"
          />
        </Field>

        {activeNode === "parameter" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Variable type">
              <input
                value={formState.variableType}
                onChange={(event) => setFormState((current) => ({ ...current, variableType: event.target.value }))}
                className={inputClass()}
                placeholder="string"
              />
            </Field>
            <Field label="Pin type">
              <input
                value={formState.pinType}
                onChange={(event) => setFormState((current) => ({ ...current, pinType: event.target.value }))}
                className={inputClass()}
                placeholder="Optional"
              />
            </Field>
          </div>
        ) : null}

        {activeNode === "itemType" ? (
          <>
            <Field label="Synonyms">
              <input
                value={formState.synonyms}
                onChange={(event) => setFormState((current) => ({ ...current, synonyms: event.target.value }))}
                className={inputClass()}
                placeholder="alias1, alias2"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor name">
                <input
                  value={formState.vendorName}
                  onChange={(event) => setFormState((current) => ({ ...current, vendorName: event.target.value }))}
                  className={inputClass()}
                  placeholder="Tuya"
                />
              </Field>
              <Field label="Parameter name">
                <input
                  value={formState.parameterName}
                  onChange={(event) => setFormState((current) => ({ ...current, parameterName: event.target.value }))}
                  className={inputClass()}
                  placeholder="switch_1"
                />
              </Field>
            </div>
          </>
        ) : null}

        {activeNode === "communication" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Group name" required>
                <input
                  value={formState.groupName}
                  onChange={(event) => setFormState((current) => ({ ...current, groupName: event.target.value }))}
                  className={inputClass()}
                  placeholder="Tuya"
                />
              </Field>
              <Field label="Protocol" required>
                <select
                  value={formState.protocol}
                  onChange={(event) => setFormState((current) => ({ ...current, protocol: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="API">API</option>
                  <option value="HTTP">HTTP</option>
                  <option value="MQTT">MQTT</option>
                  <option value="WEBSOCKET">WEBSOCKET</option>
                  <option value="ZIGBEE">ZIGBEE</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Message format">
                <select
                  value={formState.messageFormat}
                  onChange={(event) => setFormState((current) => ({ ...current, messageFormat: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="JSON">JSON</option>
                  <option value="ARRAY">ARRAY</option>
                  <option value="XML">XML</option>
                </select>
              </Field>
              <Field label="Centric">
                <select
                  value={formState.centric}
                  onChange={(event) => setFormState((current) => ({ ...current, centric: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="TOPIC">TOPIC</option>
                  <option value="PAYLOAD">PAYLOAD</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Communication method">
                <select
                  value={formState.communicationMethod}
                  onChange={(event) => setFormState((current) => ({ ...current, communicationMethod: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="PUBLISH">PUBLISH</option>
                  <option value="SUBSCRIBE">SUBSCRIBE</option>
                  <option value="HTTP">HTTP</option>
                  <option value="REST">REST</option>
                </select>
              </Field>
              <Field label="Icon">
                <input
                  value={formState.iconName}
                  onChange={(event) => setFormState((current) => ({ ...current, iconName: event.target.value }))}
                  className={inputClass()}
                  placeholder="radio"
                />
              </Field>
            </div>
            <Field label="Message structure / request template">
              <textarea
                value={formState.requestPayloadFormat}
                onChange={(event) => setFormState((current) => ({ ...current, requestPayloadFormat: event.target.value }))}
                className={inputClass(true)}
                rows={5}
                placeholder='{\n  "baseUrl": "https://openapi.tuyain.com"\n}'
              />
            </Field>
            <Field label="Confirmation structure / response template">
              <textarea
                value={formState.responsePayloadFormat}
                onChange={(event) => setFormState((current) => ({ ...current, responsePayloadFormat: event.target.value }))}
                className={inputClass(true)}
                rows={4}
                placeholder='{\n  "success": true\n}'
              />
            </Field>
          </>
        ) : null}

        {activeNode === "message" ? (
          <>
            <Field label="Topic / endpoint" required>
              <input
                value={formState.topic}
                onChange={(event) => setFormState((current) => ({ ...current, topic: event.target.value }))}
                className={inputClass()}
                placeholder="/v1.0/iot-03/devices/{{device_id}}/commands"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Command type">
                <select
                  value={formState.commandType}
                  onChange={(event) => setFormState((current) => ({ ...current, commandType: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PUBLISH">PUBLISH</option>
                  <option value="SUBSCRIBE">SUBSCRIBE</option>
                </select>
              </Field>
              <Field label="Policy type">
                <select
                  value={formState.policyType}
                  onChange={(event) => setFormState((current) => ({ ...current, policyType: event.target.value }))}
                  className={inputClass()}
                >
                  <option value="EXECUTE">EXECUTE</option>
                  <option value="QUERY">QUERY</option>
                  <option value="REGISTER">REGISTER</option>
                  <option value="SYNC">SYNC</option>
                  <option value="OTA">OTA</option>
                </select>
              </Field>
            </div>
            <Field label="Communication method">
              <select
                value={formState.communicationMethod}
                onChange={(event) => setFormState((current) => ({ ...current, communicationMethod: event.target.value }))}
                className={inputClass()}
              >
                <option value="PUBLISH">PUBLISH</option>
                <option value="SUBSCRIBE">SUBSCRIBE</option>
                <option value="REST">REST</option>
                <option value="HTTP">HTTP</option>
              </select>
            </Field>
            <Field label="Request payload format">
              <textarea
                value={formState.requestPayloadFormat}
                onChange={(event) => setFormState((current) => ({ ...current, requestPayloadFormat: event.target.value }))}
                className={inputClass(true)}
                rows={6}
                placeholder='{\n  "commands": [\n    {\n      "code": "switch_1",\n      "value": true\n    }\n  ]\n}'
              />
            </Field>
            <Field label="Response payload format">
              <textarea
                value={formState.responsePayloadFormat}
                onChange={(event) => setFormState((current) => ({ ...current, responsePayloadFormat: event.target.value }))}
                className={inputClass(true)}
                rows={4}
                placeholder='{\n  "success": true\n}'
              />
            </Field>
          </>
        ) : null}

        {activeNode === "item" ? (
          <>
            <Field label="Item code">
              <input
                value={formState.itemCode}
                onChange={(event) => setFormState((current) => ({ ...current, itemCode: event.target.value }))}
                className={inputClass()}
                placeholder="AUTO_CODE"
              />
            </Field>
            <Field label="Metadata">
              <textarea
                value={formState.metadata}
                onChange={(event) => setFormState((current) => ({ ...current, metadata: event.target.value }))}
                className={inputClass(true)}
                rows={4}
                placeholder="{}"
              />
            </Field>
            <Field label="Item polling config">
              <textarea
                value={formState.itemPollingConfig}
                onChange={(event) => setFormState((current) => ({ ...current, itemPollingConfig: event.target.value }))}
                className={inputClass(true)}
                rows={4}
                placeholder="{}"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gateway">
                <input
                  value={formState.gateway}
                  onChange={(event) => setFormState((current) => ({ ...current, gateway: event.target.value }))}
                  className={inputClass()}
                  placeholder="Optional gateway"
                />
              </Field>
              <Field label="Icon">
                <input
                  value={formState.iconName}
                  onChange={(event) => setFormState((current) => ({ ...current, iconName: event.target.value }))}
                  className={inputClass()}
                  placeholder="Device"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tags">
                <input
                  value={formState.tags}
                  onChange={(event) => setFormState((current) => ({ ...current, tags: event.target.value }))}
                  className={inputClass()}
                  placeholder="switch, tuya, lighting"
                />
              </Field>
              <Field label="Component count">
                <input
                  value={formState.componentCount}
                  onChange={(event) => setFormState((current) => ({ ...current, componentCount: event.target.value }))}
                  className={inputClass()}
                  placeholder="1"
                />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-[18px] border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-3">
              <input
                type="checkbox"
                checked={formState.secureItem}
                onChange={(event) => setFormState((current) => ({ ...current, secureItem: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[var(--iotiq-border)]"
              />
              <div>
                <p className="text-[12px] font-medium text-[var(--iotiq-text)]">Secure item</p>
                <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                  Enable when the item requires secure communication or elevated policy handling.
                </p>
              </div>
            </label>
          </>
        ) : null}

        {(activeNode === "parameter") ? (
          <Field label="Description">
            <textarea
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              className={inputClass(true)}
              rows={3}
              placeholder="Optional notes"
            />
          </Field>
        ) : null}

        {(activeNode === "communication" || activeNode === "message") ? (
          <Field label="Notes / description">
            <textarea
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              className={inputClass(true)}
              rows={3}
              placeholder="Optional notes"
            />
          </Field>
        ) : null}
      </div>
    );
  };

  const drawerTitle =
    drawerMode === "create" ? `Add ${activeConfig?.title ?? "record"}` : activeConfig?.panelTitle ?? "Library";

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-[28px] border border-[var(--iotiq-border)] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf5_100%)] px-4 py-4 shadow-[0_18px_44px_rgba(17,17,17,0.05)] md:px-5">
          <div className="flex flex-col gap-3 border-b border-[var(--iotiq-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">Provisioning canvas</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-[var(--iotiq-text)]">{title}</h2>
              <p className="mt-1 max-w-[760px] text-[12px] text-[var(--iotiq-muted)]">{subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:min-w-[320px]">
              <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--iotiq-muted)]">Completed</p>
                <p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">{completedCount}/7</p>
              </div>
              <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--iotiq-muted)]">Vendor</p>
                <p className="mt-1 truncate text-[13px] font-medium text-[var(--iotiq-text)]">{readString(values.vendorName) || "Pending"}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--iotiq-muted)]">Device</p>
                <p className="mt-1 truncate text-[13px] font-medium text-[var(--iotiq-text)]">{readString(values.name) || "Pending"}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[24px] border border-[var(--iotiq-border)] bg-[#fbfbf7] px-3 py-4 md:px-4">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(180,188,170,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(180,188,170,0.18) 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
            />

            <div className="relative hidden items-center gap-3 overflow-x-auto pb-2 lg:flex">
              {NODES.map((node, index) => {
                const Icon = node.icon;
                const value = renderNodeValue(node);
                const isSelected = activeNode === node.key;
                const isComplete = value !== "Not selected";

                return (
                  <div key={node.key} className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openDrawer(node.key, "select")}
                      className={`group flex w-[210px] items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-[#cfe2c8] bg-white shadow-[0_16px_34px_rgba(124,175,99,0.10)]"
                          : "border-[#e4e8dc] bg-white/90 shadow-[0_10px_24px_rgba(17,17,17,0.04)] hover:border-[#d7dfcd] hover:bg-white"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111111] px-1 text-[10px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <NodeIconBadge icon={Icon} accent={node.accent} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[12px] font-medium text-[var(--iotiq-text)]">{node.title}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] text-[var(--iotiq-muted)]">{value}</p>
                          </div>
                          {isComplete ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#edf6e8] text-[#6c984f]">
                              <Check size={13} />
                            </span>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f6f7f1] text-[#a8aea0]">
                              <Pencil size={12} />
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-[#8d9388]">
                            {isComplete ? "Configured" : "Not selected"}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDrawer(node.key, "create");
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[var(--iotiq-text)] transition hover:bg-white"
                            aria-label={`Add ${node.title}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </button>

                    {index < NODES.length - 1 ? (
                      <div className="flex w-10 items-center justify-center">
                        <div className="h-px w-full bg-[linear-gradient(90deg,#d9dfcf_0%,#cfd7c3_100%)]" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {NODES.map((node, index) => {
                const Icon = node.icon;
                const value = renderNodeValue(node);
                const isSelected = activeNode === node.key;
                const isComplete = value !== "Not selected";

                return (
                  <button
                    key={node.key}
                    type="button"
                    onClick={() => openDrawer(node.key, "select")}
                    className={`flex items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-[#cfe2c8] bg-white shadow-[0_16px_34px_rgba(124,175,99,0.10)]"
                        : "border-[#e4e8dc] bg-white/90 shadow-[0_10px_24px_rgba(17,17,17,0.04)]"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111111] px-1 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <NodeIconBadge icon={Icon} accent={node.accent} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-medium text-[var(--iotiq-text)]">{node.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--iotiq-muted)]">{value}</p>
                        </div>
                        {isComplete ? (
                          <BadgeCheck size={15} className="text-[#7caf63]" />
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDrawer(node.key, "create");
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[var(--iotiq-text)]"
                            aria-label={`Add ${node.title}`}
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {submitError ? (
          <p className="rounded-[20px] border border-[#efddd8] bg-[#fff7f5] px-4 py-3 text-[12px] text-[#a55a4d]">
            {submitError}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[var(--iotiq-border)] bg-white px-5 py-2.5 text-[13px] font-medium text-[var(--iotiq-text)] transition hover:bg-[#fafaf5]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-[#111111] px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#1f1f1f] disabled:opacity-55"
          >
            {isSaving ? "Saving..." : editing ? "Save Device" : "Create Device"}
          </button>
        </div>
      </form>

      <RightDrawer open={Boolean(activeNode)} onClose={closeDrawer} size="compact">
        <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fcfcf8_0%,#f7f8f2_100%)]">
          <div className="border-b border-[var(--iotiq-border)] bg-white/88 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">
                  {drawerMode === "create" ? "Create panel" : "Selection panel"}
                </p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.05em] text-[var(--iotiq-text)]">{drawerTitle}</h3>
                <p className="mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--iotiq-muted)]">
                  {activeConfig?.helper}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[var(--iotiq-text)] transition hover:bg-white"
                aria-label="Close drawer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {drawerMode === "select" ? (
              <div className="space-y-4">
                {activeNode !== "device" ? (
                  <div className="flex items-center gap-2 rounded-[20px] border border-[var(--iotiq-border)] bg-white px-3 py-2.5 shadow-[0_10px_28px_rgba(17,17,17,0.04)]">
                    <Search size={14} className="text-[var(--iotiq-muted)]" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={`Search ${activeConfig?.title?.toLowerCase() ?? "records"}`}
                      className="w-full border-0 bg-transparent text-[12px] text-[var(--iotiq-text)] outline-none placeholder:text-[#9aa094]"
                    />
                    <button
                      type="button"
                      onClick={() => activeNode && openDrawer(activeNode, "create")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[11px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
                    >
                      <Plus size={13} />
                      Add new
                    </button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {activeNode === "device" ? (
                    <button
                      type="button"
                      onClick={() => activeNode && openDrawer(activeNode, "create")}
                      className="w-full rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 text-left shadow-[0_12px_30px_rgba(17,17,17,0.04)] transition hover:border-[#d7dfcd]"
                    >
                      <p className="text-[13px] font-medium text-[var(--iotiq-text)]">
                        {deviceSummary || "Configure device runtime"}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">Open the device configuration form.</p>
                    </button>
                  ) : activeLoading ? (
                    <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 text-[12px] text-[var(--iotiq-muted)]">
                      Loading records…
                    </div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-6 text-center text-[12px] text-[var(--iotiq-muted)]">
                      No matching records. Create a new one from this panel.
                    </div>
                  ) : activeNode === "vendor" ? (
                    filteredOptions.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(17,17,17,0.04)]"
                      >
                        <VendorAvatar name={entry.label} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-[var(--iotiq-text)]">{entry.label}</p>
                            <span className="rounded-full bg-[#f6f7f1] px-2 py-0.5 text-[10px] text-[#7a816f]">
                              {entry.meta}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--iotiq-muted)]">
                            <span>{entry.detail}</span>
                            <span className="text-[#c7ccbf]">•</span>
                            <span className={`rounded-full px-2 py-0.5 ${entry.status === "active" ? "bg-[#edf6e8] text-[#6b944f]" : "bg-[#faf2df] text-[#8e6b20]"}`}>
                              {entry.status}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectOption(entry.label)}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[11px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
                        >
                          Select
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    filteredOptions.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => selectOption(entry.label)}
                        className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(17,17,17,0.04)] transition hover:border-[#d7dfcd]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--iotiq-text)]">{entry.label}</p>
                          {entry.meta || entry.detail ? (
                            <p className="mt-1 truncate text-[11px] text-[var(--iotiq-muted)]">
                              {[entry.meta, entry.detail].filter(Boolean).join(" • ")}
                            </p>
                          ) : null}
                        </div>
                        <ChevronRight size={14} className="text-[#98a08f]" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                  {activeNode === "vendor" ? renderVendorCreateForm() : renderGenericCreateForm()}
                </div>

                {drawerError ? (
                  <p className="rounded-[18px] border border-[#efddd8] bg-[#fff7f5] px-4 py-3 text-[12px] text-[#a55a4d]">
                    {drawerError}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--iotiq-border)] bg-white/86 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-[var(--iotiq-muted)]">
                {drawerMode === "create"
                  ? "Secure fields stay masked until you choose to reveal them."
                  : "Selecting a row updates the workflow node immediately."}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-2 text-[12px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
                >
                  Close
                </button>
                {drawerMode === "create" ? (
                  <button
                    type="button"
                    onClick={() => void createNodeRecord()}
                    disabled={drawerSaving}
                    className="rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#1f1f1f] disabled:opacity-55"
                  >
                    {activeNode === "device" ? "Apply" : drawerSaving ? "Saving..." : "Create"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </RightDrawer>
    </>
  );
}
