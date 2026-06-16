import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Building2,
  Cable,
  Check,
  Copy,
  Eye,
  EyeOff,
  Layers3,
  MessagesSquare,
  Plus,
  Search,
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

type WizardStep = {
  key: WorkflowNode;
  title: string;
  question: string;
  bindsTo: string;
  icon: typeof Building2;
  placeholder: string;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    key: "vendor",
    title: "Vendor",
    question: "Who manufactures this device?",
    bindsTo: "vendorName",
    icon: Building2,
    placeholder: "Search vendor records...",
  },
  {
    key: "parameter",
    title: "Parameter",
    question: "What parameter drives this device?",
    bindsTo: "parameterName",
    icon: SlidersHorizontal,
    placeholder: "Search parameters...",
  },
  {
    key: "itemType",
    title: "Item Type",
    question: "What type of device is this?",
    bindsTo: "itemTypeName",
    icon: Layers3,
    placeholder: "Search item types...",
  },
  {
    key: "communication",
    title: "Communication",
    question: "How does this device communicate?",
    bindsTo: "communicationPolicy",
    icon: Cable,
    placeholder: "Search communication policies...",
  },
  {
    key: "message",
    title: "Message",
    question: "What message template should be used?",
    bindsTo: "messageName",
    icon: MessagesSquare,
    placeholder: "Search messages...",
  },
  {
    key: "item",
    title: "Item",
    question: "Which item profile should this device bind to?",
    bindsTo: "itemName",
    icon: Boxes,
    placeholder: "Search items...",
  },
  {
    key: "device",
    title: "Review & Create",
    question: "Confirm your selections and create the device record.",
    bindsTo: "name",
    icon: BadgeCheck,
    placeholder: "",
  },
];

function readString(value: PrimitiveValue | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function deriveVendorCode(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact) return compact.slice(0, 8);
  return "VENDOR";
}

function makeEmptyState(): DrawerFormState {
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
    <label className="space-y-1.5 block">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#374151]">
        <span>{label}</span>
        {required ? <span className="text-[#ef4444]">*</span> : null}
      </div>
      {children}
      {helper ? <p className="text-[10px] text-[#9ca3af]">{helper}</p> : null}
    </label>
  );
}

function inputCls(multiline = false) {
  return multiline
    ? "w-full rounded-xl border border-[#dce4f0] bg-[#f4f8ff] px-3 py-2.5 text-[12px] text-[#111827] outline-none transition focus:border-[#3b82f6] focus:bg-white focus:ring-2 focus:ring-[#bfdbfe]/40"
    : "h-10 w-full rounded-xl border border-[#dce4f0] bg-[#f4f8ff] px-3 text-[12px] text-[#111827] outline-none transition focus:border-[#3b82f6] focus:bg-white focus:ring-2 focus:ring-[#bfdbfe]/40";
}

export default function DeviceWorkflowBuilder({
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
  const [currentStep, setCurrentStep] = useState(0);
  const [createDrawerNode, setCreateDrawerNode] = useState<WorkflowNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [formState, setFormState] = useState<DrawerFormState>(makeEmptyState());

  const stepConfig = WIZARD_STEPS[currentStep];
  const StepIcon = stepConfig.icon;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const completedCount = useMemo(
    () => WIZARD_STEPS.slice(0, -1).filter((s) => readString(values[s.bindsTo]) !== "").length,
    [values]
  );

  const vendorList = useMemo<VendorListItem[]>(() => {
    const seen = new Set<string>();
    const rows = vendorRows
      .reduce<VendorListItem[]>((acc, row) => {
        const name = readString(row.name || row.vendorName);
        if (!name) return acc;
        acc.push({
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
        return acc;
      }, [])
      .filter((entry) => {
        const key = entry.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    vendorOptions.forEach((name) => {
      const trimmed = name.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      rows.push({ id: trimmed, name: trimmed, vendorCode: deriveVendorCode(trimmed), status: "active", protocol: "API", authType: "Configured", description: "" });
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [vendorOptions, vendorRows]);

  type CardOption = { id: string; label: string; meta?: string; detail?: string; itemCount?: number };

  const currentOptions = useMemo<CardOption[]>(() => {
    const node = stepConfig.key;
    if (node === "vendor") {
      return vendorList.map((v) => ({
        id: v.id,
        label: v.name,
        meta: v.protocol ?? "Vendor",
        detail: v.vendorCode,
        itemCount: itemOptions.filter((i) => i.vendor === v.name).length,
      }));
    }
    if (node === "parameter") return parameterOptions.map((n) => ({ id: n, label: n }));
    if (node === "itemType") return itemTypeOptions.map((n) => ({ id: n, label: n }));
    if (node === "communication") return communicationPolicyOptions.map((n) => ({ id: n, label: n }));
    if (node === "message") return messageOptions.map((m) => ({ id: m.id, label: m.name, meta: m.topic }));
    if (node === "item") return itemOptions.map((m) => ({ id: m.id, label: m.name, meta: m.itemCode, detail: [m.vendor, m.itemType].filter(Boolean).join(" • ") }));
    return [];
  }, [stepConfig.key, vendorList, parameterOptions, itemTypeOptions, communicationPolicyOptions, messageOptions, itemOptions]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentOptions;
    return currentOptions.filter((o) => [o.label, o.meta, o.detail].some((v) => v?.toLowerCase().includes(q)));
  }, [currentOptions, searchQuery]);

  const isStepLoading =
    (stepConfig.key === "vendor" && vendorsLoading) ||
    (stepConfig.key === "parameter" && parametersLoading) ||
    (stepConfig.key === "itemType" && itemTypesLoading) ||
    (stepConfig.key === "communication" && communicationPoliciesLoading) ||
    (stepConfig.key === "message" && messagesLoading);

  const currentValue = readString(values[stepConfig.bindsTo]);

  const canContinue = useMemo(() => {
    if (isLastStep) return readString(values.name) !== "" && readString(values.serialNumber) !== "";
    return currentValue !== "";
  }, [isLastStep, values, currentValue]);

  const handleSelect = (label: string) => {
    const node = stepConfig.key;
    if (node === "vendor") onValueChange("vendorName", label);
    else if (node === "parameter") onValueChange("parameterName", label);
    else if (node === "itemType") onValueChange("itemTypeName", label);
    else if (node === "communication") onValueChange("communicationPolicy", label);
    else if (node === "message") onValueChange("messageName", label);
    else if (node === "item") {
      const sel = itemOptions.find((e) => e.name === label);
      if (sel) {
        onValueChange("itemName", sel.name);
        onValueChange("itemCode", sel.itemCode);
        if (sel.vendor) onValueChange("vendorName", sel.vendor);
        if (sel.itemType) onValueChange("itemTypeName", sel.itemType);
        if (sel.communicationPolicy) onValueChange("communicationPolicy", sel.communicationPolicy);
      }
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
    setSearchQuery("");
  };

  const handleNext = () => {
    if (!isLastStep) goToStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  };

  const openCreateDrawer = (node: WorkflowNode) => {
    setCreateDrawerNode(node);
    setDrawerError(null);
    setShowClientSecret(false);
    setFormState({
      ...makeEmptyState(),
      vendorCode: node === "vendor" ? deriveVendorCode(readString(values.vendorName) || "Vendor") : "",
      vendorName: readString(values.vendorName) || "",
      parameterName: readString(values.parameterName) || "",
    });
  };

  const closeCreateDrawer = () => {
    setCreateDrawerNode(null);
    setDrawerError(null);
    setDrawerSaving(false);
  };

  const copyClientSecret = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(formState.clientSecret);
  };

  const createNodeRecord = async () => {
    if (!createDrawerNode) return;
    const name = formState.name.trim();
    if (!name) { setDrawerError("Name is required."); return; }

    setDrawerSaving(true);
    setDrawerError(null);
    try {
      if (createDrawerNode === "vendor") {
        await onCreateVendor({ name, description: formState.description.trim() || undefined, protocol: formState.protocol.trim() || undefined, baseUrl: formState.apiBaseUrl.trim() || undefined, authType: formState.authType.trim() || undefined, clientId: formState.clientId.trim() || undefined, clientSecret: formState.clientSecret.trim() || undefined, tokenUrl: formState.tokenUrl.trim() || undefined, vendorCode: formState.vendorCode.trim() || undefined, uid: formState.uid.trim() || undefined, mqttEndpoint: formState.mqttEndpoint.trim() || undefined, status: formState.status.trim() || undefined, notes: formState.notes.trim() || undefined });
        onValueChange("vendorName", name);
      }
      if (createDrawerNode === "parameter") {
        await onCreateParameter({ name, vendors: readString(values.vendorName) || undefined, variableType: formState.variableType.trim() || "string", pinType: formState.pinType.trim() || undefined });
        onValueChange("parameterName", name);
      }
      if (createDrawerNode === "itemType") {
        await onCreateItemType({ name, description: formState.description.trim() || undefined, synonyms: formState.synonyms.trim() || undefined, vendorName: formState.vendorName.trim() || readString(values.vendorName) || undefined });
        onValueChange("itemTypeName", name);
      }
      if (createDrawerNode === "communication") {
        await onCreateCommunication({ name, groupName: formState.groupName.trim() || readString(values.vendorName) || "default", itemType: readString(values.itemTypeName) || "generic", protocol: formState.protocol.trim() || "MQTT", messageFormat: formState.messageFormat.trim() || "JSON", centric: formState.centric.trim() || "TOPIC", communicationMethod: formState.communicationMethod.trim() || undefined, icon: formState.iconName.trim() || "radio", messageStructure: formState.requestPayloadFormat.trim() || undefined, confirmationMessageStructure: formState.responsePayloadFormat.trim() || undefined });
        onValueChange("communicationPolicy", name);
      }
      if (createDrawerNode === "message") {
        const itemType = readString(values.itemTypeName);
        const communicationPolicy = readString(values.communicationPolicy);
        if (!itemType || !communicationPolicy) throw new Error("Select item type and communication policy before creating a message.");
        await onCreateMessage({ name, itemType, communicationPolicy, topic: formState.topic.trim() || "mqtt/device/{{thingName}}/control", messageType: formState.messageFormat.trim() || "UPDATE", commandType: formState.commandType.trim() || "POST", policyType: formState.policyType.trim() || "EXECUTE", communicationMethod: formState.communicationMethod.trim() || "PUBLISH", requestPayloadFormat: formState.requestPayloadFormat.trim() || undefined, responsePayloadFormat: formState.responsePayloadFormat.trim() || undefined, payloadFormat: formState.requestPayloadFormat.trim() || undefined, confirmationPayloadFormat: formState.responsePayloadFormat.trim() || undefined, notes: formState.description.trim() || undefined });
        onValueChange("messageName", name);
      }
      if (createDrawerNode === "item") {
        const vendor = readString(values.vendorName);
        const itemType = readString(values.itemTypeName);
        const communicationPolicy = readString(values.communicationPolicy);
        if (!vendor || !itemType || !communicationPolicy) throw new Error("Select vendor, item type, and communication policy before creating an item.");
        const itemCode = formState.itemCode.trim() || name.replace(/\s+/g, "_").toUpperCase();
        await onCreateItem({ name, itemCode, vendor, itemType, communicationPolicy, description: formState.description.trim() || undefined, metadata: formState.metadata.trim() || undefined, itemPollingConfig: formState.itemPollingConfig.trim() || undefined, gateway: formState.gateway.trim() || undefined, icon: formState.iconName.trim() || undefined, tags: formState.tags.trim() || undefined, componentCount: formState.componentCount.trim() ? Number(formState.componentCount) : undefined, secureItem: formState.secureItem });
        onValueChange("itemName", name);
        onValueChange("itemCode", itemCode);
      }
      closeCreateDrawer();
    } catch (error) {
      setDrawerError(error instanceof Error ? error.message : "Unable to create record");
    } finally {
      setDrawerSaving(false);
    }
  };

  const renderVendorCreateForm = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor name" required>
          <input value={formState.name} onChange={(e) => setFormState((c) => ({ ...c, name: e.target.value }))} className={inputCls()} placeholder="ELEVATE Systems" />
        </Field>
        <Field label="Vendor code">
          <input value={formState.vendorCode} onChange={(e) => setFormState((c) => ({ ...c, vendorCode: e.target.value }))} className={inputCls()} placeholder="ELVT01" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Protocol" required>
          <select value={formState.protocol} onChange={(e) => setFormState((c) => ({ ...c, protocol: e.target.value }))} className={inputCls()}>
            <option value="API">API</option>
            <option value="HTTP">HTTP</option>
            <option value="MQTT">MQTT</option>
            <option value="WEBSOCKET">WEBSOCKET</option>
            <option value="ZIGBEE">ZIGBEE</option>
          </select>
        </Field>
        <Field label="Auth type">
          <select value={formState.authType} onChange={(e) => setFormState((c) => ({ ...c, authType: e.target.value }))} className={inputCls()}>
            <option value="OAUTH2">OAUTH2</option>
            <option value="Credentials">Credentials</option>
            <option value="JWT">JWT</option>
            <option value="Certificate">Certificate</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client ID">
          <input value={formState.clientId} onChange={(e) => setFormState((c) => ({ ...c, clientId: e.target.value }))} className={inputCls()} placeholder="client-app-id" />
        </Field>
        <Field label="UID">
          <input value={formState.uid} onChange={(e) => setFormState((c) => ({ ...c, uid: e.target.value }))} className={inputCls()} placeholder="vendor-uid" />
        </Field>
      </div>
      <Field label="Client secret">
        <div className="relative">
          <input type={showClientSecret ? "text" : "password"} value={formState.clientSecret} onChange={(e) => setFormState((c) => ({ ...c, clientSecret: e.target.value }))} className={`${inputCls()} pr-20`} placeholder="Protected secret" />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            <button type="button" onClick={() => setShowClientSecret((v) => !v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6]">
              {showClientSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button type="button" onClick={() => void copyClientSecret()} disabled={!formState.clientSecret.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6] disabled:opacity-35">
              <Copy size={13} />
            </button>
          </div>
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="API base URL">
          <input value={formState.apiBaseUrl} onChange={(e) => setFormState((c) => ({ ...c, apiBaseUrl: e.target.value }))} className={inputCls()} placeholder="https://api.vendor.com" />
        </Field>
        <Field label="MQTT endpoint">
          <input value={formState.mqttEndpoint} onChange={(e) => setFormState((c) => ({ ...c, mqttEndpoint: e.target.value }))} className={inputCls()} placeholder="mqtt.vendor.com" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Token URL">
          <input value={formState.tokenUrl} onChange={(e) => setFormState((c) => ({ ...c, tokenUrl: e.target.value }))} className={inputCls()} placeholder="https://auth.vendor.com/token" />
        </Field>
        <Field label="Status">
          <select value={formState.status} onChange={(e) => setFormState((c) => ({ ...c, status: e.target.value }))} className={inputCls()}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea value={formState.description} onChange={(e) => setFormState((c) => ({ ...c, description: e.target.value }))} className={inputCls(true)} rows={3} placeholder="Short vendor summary" />
      </Field>
      <Field label="Notes">
        <textarea value={formState.notes} onChange={(e) => setFormState((c) => ({ ...c, notes: e.target.value }))} className={inputCls(true)} rows={2} placeholder="Operational notes" />
      </Field>
    </div>
  );

  const renderGenericCreateForm = () => {
    if (!createDrawerNode || createDrawerNode === "device") return null;
    return (
      <div className="space-y-4">
        <Field label="Name" required>
          <input value={formState.name} onChange={(e) => setFormState((c) => ({ ...c, name: e.target.value }))} className={inputCls()} placeholder="Enter name" />
        </Field>

        {createDrawerNode === "parameter" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Variable type">
              <input value={formState.variableType} onChange={(e) => setFormState((c) => ({ ...c, variableType: e.target.value }))} className={inputCls()} placeholder="string" />
            </Field>
            <Field label="Pin type">
              <input value={formState.pinType} onChange={(e) => setFormState((c) => ({ ...c, pinType: e.target.value }))} className={inputCls()} placeholder="Optional" />
            </Field>
          </div>
        ) : null}

        {createDrawerNode === "itemType" ? (
          <>
            <Field label="Synonyms">
              <input value={formState.synonyms} onChange={(e) => setFormState((c) => ({ ...c, synonyms: e.target.value }))} className={inputCls()} placeholder="alias1, alias2" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor name">
                <input value={formState.vendorName} onChange={(e) => setFormState((c) => ({ ...c, vendorName: e.target.value }))} className={inputCls()} placeholder="Tuya" />
              </Field>
              <Field label="Parameter name">
                <input value={formState.parameterName} onChange={(e) => setFormState((c) => ({ ...c, parameterName: e.target.value }))} className={inputCls()} placeholder="switch_1" />
              </Field>
            </div>
          </>
        ) : null}

        {createDrawerNode === "communication" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Group name" required>
                <input value={formState.groupName} onChange={(e) => setFormState((c) => ({ ...c, groupName: e.target.value }))} className={inputCls()} placeholder="Tuya" />
              </Field>
              <Field label="Protocol" required>
                <select value={formState.protocol} onChange={(e) => setFormState((c) => ({ ...c, protocol: e.target.value }))} className={inputCls()}>
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
                <select value={formState.messageFormat} onChange={(e) => setFormState((c) => ({ ...c, messageFormat: e.target.value }))} className={inputCls()}>
                  <option value="JSON">JSON</option>
                  <option value="ARRAY">ARRAY</option>
                  <option value="XML">XML</option>
                </select>
              </Field>
              <Field label="Centric">
                <select value={formState.centric} onChange={(e) => setFormState((c) => ({ ...c, centric: e.target.value }))} className={inputCls()}>
                  <option value="TOPIC">TOPIC</option>
                  <option value="PAYLOAD">PAYLOAD</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Communication method">
                <select value={formState.communicationMethod} onChange={(e) => setFormState((c) => ({ ...c, communicationMethod: e.target.value }))} className={inputCls()}>
                  <option value="PUBLISH">PUBLISH</option>
                  <option value="SUBSCRIBE">SUBSCRIBE</option>
                  <option value="HTTP">HTTP</option>
                  <option value="REST">REST</option>
                </select>
              </Field>
              <Field label="Icon">
                <input value={formState.iconName} onChange={(e) => setFormState((c) => ({ ...c, iconName: e.target.value }))} className={inputCls()} placeholder="radio" />
              </Field>
            </div>
            <Field label="Message structure / request template">
              <textarea value={formState.requestPayloadFormat} onChange={(e) => setFormState((c) => ({ ...c, requestPayloadFormat: e.target.value }))} className={inputCls(true)} rows={5} />
            </Field>
            <Field label="Confirmation structure / response template">
              <textarea value={formState.responsePayloadFormat} onChange={(e) => setFormState((c) => ({ ...c, responsePayloadFormat: e.target.value }))} className={inputCls(true)} rows={4} />
            </Field>
          </>
        ) : null}

        {createDrawerNode === "message" ? (
          <>
            <Field label="Topic / endpoint" required>
              <input value={formState.topic} onChange={(e) => setFormState((c) => ({ ...c, topic: e.target.value }))} className={inputCls()} placeholder="/v1.0/iot-03/devices/{{device_id}}/commands" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Command type">
                <select value={formState.commandType} onChange={(e) => setFormState((c) => ({ ...c, commandType: e.target.value }))} className={inputCls()}>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PUBLISH">PUBLISH</option>
                  <option value="SUBSCRIBE">SUBSCRIBE</option>
                </select>
              </Field>
              <Field label="Policy type">
                <select value={formState.policyType} onChange={(e) => setFormState((c) => ({ ...c, policyType: e.target.value }))} className={inputCls()}>
                  <option value="EXECUTE">EXECUTE</option>
                  <option value="QUERY">QUERY</option>
                  <option value="REGISTER">REGISTER</option>
                  <option value="SYNC">SYNC</option>
                  <option value="OTA">OTA</option>
                </select>
              </Field>
            </div>
            <Field label="Communication method">
              <select value={formState.communicationMethod} onChange={(e) => setFormState((c) => ({ ...c, communicationMethod: e.target.value }))} className={inputCls()}>
                <option value="PUBLISH">PUBLISH</option>
                <option value="SUBSCRIBE">SUBSCRIBE</option>
                <option value="REST">REST</option>
                <option value="HTTP">HTTP</option>
              </select>
            </Field>
            <Field label="Request payload format">
              <textarea value={formState.requestPayloadFormat} onChange={(e) => setFormState((c) => ({ ...c, requestPayloadFormat: e.target.value }))} className={inputCls(true)} rows={5} />
            </Field>
            <Field label="Response payload format">
              <textarea value={formState.responsePayloadFormat} onChange={(e) => setFormState((c) => ({ ...c, responsePayloadFormat: e.target.value }))} className={inputCls(true)} rows={4} />
            </Field>
          </>
        ) : null}

        {createDrawerNode === "item" ? (
          <>
            <Field label="Item code">
              <input value={formState.itemCode} onChange={(e) => setFormState((c) => ({ ...c, itemCode: e.target.value }))} className={inputCls()} placeholder="AUTO_CODE" />
            </Field>
            <Field label="Metadata">
              <textarea value={formState.metadata} onChange={(e) => setFormState((c) => ({ ...c, metadata: e.target.value }))} className={inputCls(true)} rows={4} placeholder="{}" />
            </Field>
            <Field label="Item polling config">
              <textarea value={formState.itemPollingConfig} onChange={(e) => setFormState((c) => ({ ...c, itemPollingConfig: e.target.value }))} className={inputCls(true)} rows={4} placeholder="{}" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gateway">
                <input value={formState.gateway} onChange={(e) => setFormState((c) => ({ ...c, gateway: e.target.value }))} className={inputCls()} placeholder="Optional gateway" />
              </Field>
              <Field label="Icon">
                <input value={formState.iconName} onChange={(e) => setFormState((c) => ({ ...c, iconName: e.target.value }))} className={inputCls()} placeholder="Device" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tags">
                <input value={formState.tags} onChange={(e) => setFormState((c) => ({ ...c, tags: e.target.value }))} className={inputCls()} placeholder="switch, tuya, lighting" />
              </Field>
              <Field label="Component count">
                <input value={formState.componentCount} onChange={(e) => setFormState((c) => ({ ...c, componentCount: e.target.value }))} className={inputCls()} placeholder="1" />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-[#263047] bg-[#1a2235] px-3 py-3">
              <input type="checkbox" checked={formState.secureItem} onChange={(e) => setFormState((c) => ({ ...c, secureItem: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded accent-[#f87171]" />
              <div>
                <p className="text-[12px] font-semibold text-[#f8fafc]">Secure item</p>
                <p className="mt-0.5 text-[11px] text-[#516a87]">Enable when the item requires secure communication or elevated policy handling.</p>
              </div>
            </label>
          </>
        ) : null}

        {(createDrawerNode === "parameter" || createDrawerNode === "communication" || createDrawerNode === "message") ? (
          <Field label="Notes / description">
            <textarea value={formState.description} onChange={(e) => setFormState((c) => ({ ...c, description: e.target.value }))} className={inputCls(true)} rows={3} placeholder="Optional notes" />
          </Field>
        ) : null}
      </div>
    );
  };

  const drawerTitle = `Add ${WIZARD_STEPS.find((s) => s.key === createDrawerNode)?.title ?? "record"}`;

  return (
    <form onSubmit={onSubmit} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#eef2f8]">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-start justify-between border-b border-[#e5ebf4] bg-white px-8 py-5">
        <div>
          <nav className="flex items-center gap-2">
            <span className="rounded-md bg-[#0f172a]/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a]">
              IOTIQ PLATFORM
            </span>
            <span className="text-[13px] text-[#cbd5e1]">›</span>
            <span className="text-[12px] font-medium text-[#66758a]">Device provisioning</span>
          </nav>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-[#0f172a]">
            {editing ? "Edit Device" : "Create Device"}
          </h1>
          <p className="mt-1 text-[13px] text-[#66758a]">
            Assemble catalog components in order, then create the device record.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-xl border border-[#e5ebf4] bg-[#f8fbff] px-4 py-2 text-[13px] font-medium text-[#66758a] transition hover:border-[#cbd5e1] hover:text-[#111827]"
        >
          <X size={15} />
          Close
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-5 overflow-hidden p-5">

        {/* Left sidebar ─────────────────────────────────────────────────────── */}
        <div className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#e5ebf4] bg-white">

          {/* Header — mirrors the app sidebar logo area */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-[#2f6df6] shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                <BadgeCheck size={16} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[12px] font-black uppercase leading-[1.2] tracking-[0.04em] text-[#0f172a]">
                  {editing ? "Edit Device" : "Create Device"}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase leading-[1.2] tracking-[0.16em] text-[#9aa9bd]">
                  Device Provisioning
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa9bd]">Progress</span>
                <span className="text-[10px] font-bold text-[#0f172a]">{completedCount} / {WIZARD_STEPS.length - 1}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e6edf7]">
                <div
                  className="h-full rounded-full bg-[#2f6df6] transition-all duration-500"
                  style={{ width: `${(completedCount / (WIZARD_STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mx-4 border-t border-[#e5ebf4]" />

          {/* Steps list — mirrors NavItem style */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {WIZARD_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === index;
                const isCompleted = index < WIZARD_STEPS.length - 1 && readString(values[step.bindsTo]) !== "";
                const stepValue = readString(values[step.bindsTo]);

                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      onClick={() => goToStep(index)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition duration-200 ${
                        isActive
                          ? "bg-[#0f172a] text-white shadow-[0_14px_28px_rgba(15,23,42,0.22)]"
                          : "text-[#66758a] hover:bg-[#f8fbff] hover:text-[#111827]"
                      }`}
                    >
                      {/* Icon */}
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition duration-200 ${
                        isActive
                          ? "text-[#2f6df6]"
                          : isCompleted
                          ? "text-[#2f6df6] group-hover:text-[#111827]"
                          : "text-[#66758a] group-hover:text-[#111827]"
                      }`}>
                        {isCompleted && !isActive ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                      </span>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[14px] ${isActive ? "font-black text-white" : "font-bold text-inherit"}`}>
                          {step.title}
                        </p>
                        <p className={`truncate text-[11px] ${
                          isActive ? "font-bold text-[#aeb8c8]" : "font-semibold text-[#9aa9bd]"
                        }`}>
                          {isActive ? "In Progress" : isCompleted ? stepValue : "Not selected"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right panel ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#dce4f0] bg-white">

          {/* Step header */}
          <div className="shrink-0 border-b border-[#e5ebf4] px-8 py-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa9bd]">
              Step {currentStep + 1} of {WIZARD_STEPS.length}
            </span>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-[#2f6df6] shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                <StepIcon size={20} strokeWidth={1.8} />
              </div>
              <h2 className="text-[26px] font-black tracking-tight text-[#0f172a]">{stepConfig.title}</h2>
            </div>
            <p className="mt-2 text-[13px] font-medium text-[#66758a]">{stepConfig.question}</p>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!isLastStep ? (
              <div>
                {/* Search + Create new */}
                <div className="mb-5 flex gap-3">
                  <div className="relative flex-1">
                    <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={stepConfig.placeholder}
                      className="h-11 w-full rounded-xl border border-[#dce4f0] bg-[#f4f8ff] pl-10 pr-4 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#3b82f6] focus:bg-white focus:ring-2 focus:ring-[#bfdbfe]/40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateDrawer(stepConfig.key)}
                    className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#dce4f0] bg-white px-4 text-[13px] font-medium text-[#374151] transition hover:border-[#3b82f6] hover:text-[#2563eb]"
                  >
                    <Plus size={14} />
                    Create new
                  </button>
                </div>

                {/* Card grid */}
                {isStepLoading ? (
                  <div className="py-16 text-center text-[13px] text-[#6b7280]">Loading records...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-[#dce4f0] py-14 text-center">
                    <p className="text-[13px] font-medium text-[#6b7280]">No records found</p>
                    <p className="mt-1 text-[12px] text-[#9ca3af]">Use the button above to create one.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredOptions.map((option) => {
                      const isSelected = currentValue === option.label;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleSelect(option.label)}
                          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-[#2563eb] bg-[#eff6ff] shadow-[0_0_0_1px_rgba(37,99,235,0.2)]"
                              : "border-[#dce4f0] bg-white hover:border-[#93c5fd] hover:bg-[#f0f7ff]"
                          }`}
                        >
                          {/* Card icon */}
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isSelected ? "bg-[#dbeafe]" : "bg-[#f1f5f9]"}`}>
                            <StepIcon size={18} className={isSelected ? "text-[#2563eb]" : "text-[#9ca3af]"} />
                          </div>
                          {/* Card text */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[#111827]">{option.label}</p>
                            <p className="mt-0.5 truncate text-[11px] text-[#6b7280]">
                              {stepConfig.key === "vendor"
                                ? `${option.itemCount ?? 0} device families`
                                : option.detail || option.meta || "—"}
                            </p>
                          </div>
                          {/* Radio */}
                          <div className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${
                            isSelected ? "border-[#2563eb]" : "border-[#d1d5db]"
                          }`}>
                            {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ── Review & Create step ──────────────────────────────────────── */
              <div className="max-w-2xl space-y-6">
                {/* Selections summary */}
                <div>
                  <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">
                    Selected catalog components
                  </h3>
                  <div className="overflow-hidden rounded-2xl border border-[#dce4f0] divide-y divide-[#f1f5f9]">
                    {WIZARD_STEPS.slice(0, -1).map((step) => {
                      const val = readString(values[step.bindsTo]);
                      const SIcon = step.icon;
                      return (
                        <div key={step.key} className="flex items-center gap-3 bg-white px-4 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff]">
                            <SIcon size={14} className="text-[#2563eb]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">{step.title}</p>
                            <p className="truncate text-[13px] font-semibold text-[#111827]">{val || "Not selected"}</p>
                          </div>
                          {val ? (
                            <Check size={15} className="shrink-0 text-[#2563eb]" />
                          ) : (
                            <span className="shrink-0 text-[11px] font-medium text-[#9ca3af]">Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Device config form */}
                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Device configuration</h3>
                  <Field label="Device name" required>
                    <input value={readString(values.name)} onChange={(e) => onValueChange("name", e.target.value)} className={inputCls()} placeholder="Turbo Controller 01" />
                  </Field>
                  <Field label="Serial number" required>
                    <input value={readString(values.serialNumber)} onChange={(e) => onValueChange("serialNumber", e.target.value)} className={inputCls()} placeholder="IOTIQDC2_A1025048" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Connection type" required>
                      <select value={readString(values.connectionType) || "MQTT"} onChange={(e) => onValueChange("connectionType", e.target.value)} className={inputCls()}>
                        <option value="MQTT">MQTT</option>
                        <option value="API">API</option>
                        <option value="WEBSOCKET">WEBSOCKET</option>
                        <option value="WIFI">WIFI</option>
                      </select>
                    </Field>
                    <Field label="Project" required>
                      <input value={readString(values.project)} onChange={(e) => onValueChange("project", e.target.value)} className={inputCls()} placeholder="project_a" />
                    </Field>
                  </div>
                </div>

                {submitError ? (
                  <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-[12px] text-[#f87171]">
                    {submitError}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="shrink-0 border-t border-[#dce4f0] bg-[#f0f5ff] px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="flex items-center gap-2 rounded-xl border border-[#dce4f0] bg-white px-5 py-2.5 text-[13px] font-medium text-[#374151] transition hover:border-[#93c5fd] hover:text-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} />
                Back
              </button>

              <span className="text-center text-[12px] text-[#6b7280]">
                {isLastStep
                  ? "Review and finalize your device"
                  : currentValue
                  ? `Selected: ${currentValue}`
                  : "Select a record to continue"}
              </span>

              {isLastStep ? (
                <button
                  type="submit"
                  disabled={isSaving || !canContinue}
                  className="flex items-center gap-2 rounded-xl bg-[#2563eb] px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Creating..." : editing ? "Save Device" : "Create Device"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canContinue}
                  className="flex items-center gap-2 rounded-xl bg-[#2563eb] px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#9ca3af] disabled:shadow-none"
                >
                  Continue
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create new drawer ───────────────────────────────────────────────────── */}
      <RightDrawer open={Boolean(createDrawerNode)} onClose={closeCreateDrawer} size="compact">
        <div className="flex h-full flex-col bg-white">
          <div className="border-b border-[#dce4f0] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">Create panel</p>
                <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-[#111827]">{drawerTitle}</h3>
              </div>
              <button type="button" onClick={closeCreateDrawer} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dce4f0] bg-[#f4f8ff] text-[#6b7280] transition hover:border-[#93c5fd] hover:text-[#2563eb]" aria-label="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded-2xl border border-[#dce4f0] bg-[#f8fafc] px-4 py-4">
              {createDrawerNode === "vendor" ? renderVendorCreateForm() : renderGenericCreateForm()}
            </div>
            {drawerError ? (
              <p className="mt-3 rounded-xl border border-[#fca5a5]/40 bg-[#fef2f2] px-4 py-3 text-[12px] text-[#dc2626]">
                {drawerError}
              </p>
            ) : null}
          </div>

          <div className="border-t border-[#dce4f0] bg-[#f0f5ff] px-4 py-3">
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeCreateDrawer} className="rounded-xl border border-[#dce4f0] bg-white px-4 py-2 text-[12px] font-medium text-[#374151] transition hover:border-[#93c5fd] hover:text-[#2563eb]">
                Cancel
              </button>
              <button type="button" onClick={() => void createNodeRecord()} disabled={drawerSaving} className="rounded-xl bg-[#2563eb] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8] disabled:opacity-50">
                {drawerSaving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </RightDrawer>
    </form>
  );
}
