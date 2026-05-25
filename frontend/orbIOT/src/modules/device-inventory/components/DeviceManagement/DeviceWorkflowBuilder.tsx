import { Fragment, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

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
  parameterOptions: string[];
  itemTypeOptions: string[];
  communicationPolicyOptions: string[];
  messageOptions: OptionItem[];
  itemOptions: ItemOption[];
  onValueChange: (key: string, value: PrimitiveValue) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onCreateVendor: (payload: Record<string, unknown>) => Promise<void>;
  onCreateParameter: (payload: Record<string, unknown>) => Promise<void>;
  onCreateItemType: (payload: Record<string, unknown>) => Promise<void>;
  onCreateCommunication: (payload: Record<string, unknown>) => Promise<void>;
  onCreateMessage: (payload: Record<string, unknown>) => Promise<void>;
  onCreateItem: (payload: Record<string, unknown>) => Promise<void>;
}

type ActiveOption = {
  id: string;
  label: string;
  meta?: string;
};

// ── Constants shared with the standalone form pages ──────────────────────────

const VENDOR_INDUSTRIES = [
  "AGRICULTURE", "AUTOMOTIVE", "BANKING_FINANCE", "CONSTRUCTION",
  "EDUCATION", "ENERGY", "HEALTHCARE", "HOSPITALITY",
  "INFORMATION_TECHNOLOGY", "MANUFACTURING", "MEDIA_ENTERTAINMENT",
  "REAL_ESTATE", "RETAIL", "TELECOMMUNICATIONS", "TRANSPORTATION",
  "IOT", "MARKETING", "CONSULTING", "LOGISTICS", "OTHER",
];

const VARIABLE_TYPES = [
  "STRING", "INTEGER", "FLOAT", "BOOLEAN",
  "ARRAY", "INTEGER_RANGE", "FLOAT_RANGE", "ENUM", "JSON",
];

const ICON_OPTIONS = [
  "Charger", "Sensor", "Light", "Fan", "Music", "Switch",
  "Drone", "Car", "Energy", "Video", "Audio", "Bike",
  "Truck", "Device", "Thing",
];

const MESSAGE_TYPES = [
  "ON_OFF", "SET_ADJUST", "GETDATA", "TOGGLE", "CONTROL", "SENSING",
  "SECURITY", "CONNECTION", "START_STOP", "LOCK_UNLOCK", "ARM_DISARM",
  "EMERGENCY", "PLAYBACK", "QUERY", "CALIBRATION", "DIAGNOSTIC",
  "UPDATE", "STATUS", "WRITE", "NOTIFICATION", "CONFIGURATION",
  "AUTHENTICATE", "GROUPING", "SCENE", "GEOFENCING", "SESSION", "FIRMWARE",
];

// ── Workflow layout ───────────────────────────────────────────────────────────

const WORKFLOW_NODES: Array<{ key: WorkflowNode; label: string; bindsTo: string | null }> = [
  { key: "vendor",        label: "Vendor",        bindsTo: "vendorName" },
  { key: "parameter",     label: "Parameter",     bindsTo: "parameterName" },
  { key: "itemType",      label: "Item Type",     bindsTo: "itemTypeName" },
  { key: "communication", label: "Communication", bindsTo: "communicationPolicy" },
  { key: "message",       label: "Message",       bindsTo: "messageName" },
  { key: "item",          label: "Item",          bindsTo: "itemName" },
  { key: "device",        label: "Device",        bindsTo: "name" },
];

const DESKTOP_ROWS: WorkflowNode[][] = [
  ["vendor", "parameter", "itemType"],
  ["communication", "message", "item"],
  ["device"],
];

const NODE_THEME: Record<
  WorkflowNode,
  { idle: string; selected: string; badge: string; plus: string }
> = {
  vendor: {
    idle: "border-cyan-200/90 bg-gradient-to-br from-cyan-50 to-sky-100/70",
    selected: "border-cyan-400 ring-2 ring-cyan-100",
    badge: "bg-cyan-600",
    plus: "hover:border-cyan-400 hover:text-cyan-700",
  },
  parameter: {
    idle: "border-indigo-200/90 bg-gradient-to-br from-indigo-50 to-blue-100/70",
    selected: "border-indigo-400 ring-2 ring-indigo-100",
    badge: "bg-indigo-600",
    plus: "hover:border-indigo-400 hover:text-indigo-700",
  },
  itemType: {
    idle: "border-violet-200/90 bg-gradient-to-br from-violet-50 to-fuchsia-100/70",
    selected: "border-violet-400 ring-2 ring-violet-100",
    badge: "bg-violet-600",
    plus: "hover:border-violet-400 hover:text-violet-700",
  },
  communication: {
    idle: "border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-100/70",
    selected: "border-amber-400 ring-2 ring-amber-100",
    badge: "bg-amber-600",
    plus: "hover:border-amber-400 hover:text-amber-700",
  },
  message: {
    idle: "border-rose-200/90 bg-gradient-to-br from-rose-50 to-pink-100/70",
    selected: "border-rose-400 ring-2 ring-rose-100",
    badge: "bg-rose-600",
    plus: "hover:border-rose-400 hover:text-rose-700",
  },
  item: {
    idle: "border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-green-100/70",
    selected: "border-emerald-400 ring-2 ring-emerald-100",
    badge: "bg-emerald-600",
    plus: "hover:border-emerald-400 hover:text-emerald-700",
  },
  device: {
    idle: "border-blue-200/90 bg-gradient-to-br from-blue-50 to-sky-100/70",
    selected: "border-blue-500 ring-2 ring-blue-100",
    badge: "bg-blue-700",
    plus: "hover:border-blue-500 hover:text-blue-700",
  },
};

// ── Panel state ───────────────────────────────────────────────────────────────

function emptyPanelState() {
  return {
    name: "",
    // vendor
    description: "",
    type: "",
    industry: "",
    showAdvanced: "false",
    authType: "",
    clientId: "",
    clientSecret: "",
    authorizationUrl: "",
    tokenUrl: "",
    redirectUri: "",
    tokenType: "Bearer",
    apiToken: "",
    jwtToken: "",
    certificate: "",
    publicKey: "",
    privateKey: "",
    // parameter
    paramVendor: "",
    variableType: "STRING",
    isConstant: "false",
    pinCount: "",
    pinType: "",
    // itemType
    synonyms: "",
    itemTypeVendor: "",
    itemTypeParams: "",
    // communication
    commItemType: "",
    groupName: "",
    icon: "Device",
    protocol: "",
    version: "",
    messageFormat: "",
    centric: "",
    communicationMethod: "",
    payloadTopics: "",
    messageStructure: "",
    needConfirmation: "false",
    confirmationMessageStructure: "",
    needFirmware: "false",
    // message
    msgItemType: "",
    msgCommPolicy: "",
    scope: "DEVICE",
    topic: "",
    messageType: "",
    policyType: "",
    commandType: "",
    isPayloadCentric: "false",
    topicUnique: "false",
    loggedMessage: "false",
    retainMessages: "false",
    requestPayloadFormat: "",
    responsePayloadFormat: "",
    qos: "0",
    pollingInterval: "",
    // item
    itemCode: "",
    metadata: "",
    itemPollingConfig: "",
    secureItem: "false",
    gateway: "",
    // device
    serialNumber: "",
    connectionType: "MQTT",
    project: "project_a",
    foreignId: "",
    gatewayForeignId: "",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeviceWorkflowBuilder({
  title: _title,
  subtitle: _subtitle,
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
  const [createPanelNode, setCreatePanelNode] = useState<WorkflowNode | null>(null);
  const [panelValues, setPanelValues] = useState<Record<string, string>>(emptyPanelState());
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const panelNode = createPanelNode ?? activeNode;
  const panelMode: "create" | "select" | null = createPanelNode
    ? "create"
    : activeNode
      ? "select"
      : null;
  const hasInteraction = activeNode !== null || createPanelNode !== null;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setPanelValues((p) => ({ ...p, [key]: e.target.value }));

  const activeOptions = useMemo<ActiveOption[]>(() => {
    if (!activeNode || activeNode === "device") return [];
    if (activeNode === "vendor") return vendorOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "parameter") return parameterOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "itemType") return itemTypeOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "communication") return communicationPolicyOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "message") return messageOptions.map((e) => ({ id: e.id, label: e.name, meta: e.topic ? `Topic: ${e.topic}` : "" }));
    return itemOptions.map((e) => ({ id: e.id, label: e.name, meta: e.itemCode ? `Code: ${e.itemCode}` : "" }));
  }, [activeNode, communicationPolicyOptions, itemOptions, itemTypeOptions, messageOptions, parameterOptions, vendorOptions]);

  const activeNodeTitle = WORKFLOW_NODES.find((n) => n.key === panelNode)?.label ?? "Box";
  const activeLoading =
    (panelNode === "vendor" && vendorsLoading) ||
    (panelNode === "parameter" && parametersLoading) ||
    (panelNode === "itemType" && itemTypesLoading) ||
    (panelNode === "communication" && communicationPoliciesLoading) ||
    (panelNode === "message" && messagesLoading) ||
    false;

  const selectOption = (value: string) => {
    if (!activeNode) return;
    if (activeNode === "vendor") onValueChange("vendorName", value);
    if (activeNode === "parameter") onValueChange("parameterName", value);
    if (activeNode === "itemType") onValueChange("itemTypeName", value);
    if (activeNode === "communication") onValueChange("communicationPolicy", value);
    if (activeNode === "message") onValueChange("messageName", value);
    if (activeNode === "item") {
      const selected = itemOptions.find((e) => e.name === value);
      if (!selected) return;
      onValueChange("itemName", selected.name);
      onValueChange("itemCode", selected.itemCode);
      if (selected.vendor) onValueChange("vendorName", selected.vendor);
      if (selected.itemType) onValueChange("itemTypeName", selected.itemType);
      if (selected.communicationPolicy) onValueChange("communicationPolicy", selected.communicationPolicy);
    }
  };

  const openCreatePanel = (node: WorkflowNode) => {
    setCreatePanelNode(node);
    setActiveNode(node);
    setPanelError(null);
    setPanelValues({
      ...emptyPanelState(),
      name:
        node === "item" ? String(values.itemName ?? "")
        : node === "device" ? String(values.name ?? "")
        : "",
      itemCode:       node === "item" ? String(values.itemCode ?? "") : "",
      serialNumber:   node === "device" ? String(values.serialNumber ?? "") : "",
      connectionType: node === "device" ? String(values.connectionType ?? "MQTT") : "MQTT",
      project:        node === "device" ? String(values.project ?? "project_a") : "project_a",
      // pre-fill communication group from current vendor context
      groupName:       node === "communication" ? String(values.vendorName ?? "").trim() : "",
      // pre-fill parameter vendor from current workflow vendor
      paramVendor:     node === "parameter" ? String(values.vendorName ?? "").trim() : "",
      // pre-fill itemType vendor from current workflow vendor
      itemTypeVendor:  node === "itemType" ? String(values.vendorName ?? "").trim() : "",
      // pre-fill communication item type from current workflow item type
      commItemType:    node === "communication" ? String(values.itemTypeName ?? "").trim() : "",
      // pre-fill message selects from current workflow context
      msgItemType:     node === "message" ? String(values.itemTypeName ?? "").trim() : "",
      msgCommPolicy:   node === "message" ? String(values.communicationPolicy ?? "").trim() : "",
      topic:           node === "message" ? "mqtt/device/@{deviceId}/" : "",
    });
  };

  const closeCreatePanel = () => {
    setCreatePanelNode(null);
    setPanelError(null);
    setPanelValues(emptyPanelState());
  };

  const closeContextPanel = () => {
    closeCreatePanel();
    setActiveNode(null);
  };

  const handleNodeClick = (node: WorkflowNode) => {
    setCreatePanelNode(null);
    setPanelError(null);
    setActiveNode(node);
  };

  const applyDeviceFields = () => {
    const name = panelValues.name.trim();
    const serialNumber = panelValues.serialNumber.trim();
    const connectionType = panelValues.connectionType.trim();
    const project = panelValues.project.trim();
    if (!name || !serialNumber || !connectionType || !project) {
      setPanelError("Device name, serial number, connection type, and project are required.");
      return false;
    }
    onValueChange("name", name);
    onValueChange("serialNumber", serialNumber);
    onValueChange("connectionType", connectionType);
    onValueChange("project", project);
    onValueChange("foreignId", panelValues.foreignId.trim());
    onValueChange("gatewayForeignId", panelValues.gatewayForeignId.trim());
    onValueChange("metadata", panelValues.metadata.trim());
    return true;
  };

  const createNodeRecord = async () => {
    if (!createPanelNode) return;

    if (createPanelNode === "device") {
      if (applyDeviceFields()) closeCreatePanel();
      return;
    }

    const name = panelValues.name.trim();
    if (!name && createPanelNode !== "message") { setPanelError("Name is required."); return; }

    // per-node required field checks
    if (createPanelNode === "vendor") {
      if (!panelValues.industry.trim()) { setPanelError("Industry is required."); return; }
    }
    if (createPanelNode === "parameter") {
      if (!panelValues.paramVendor.trim()) { setPanelError("Vendor is required."); return; }
    }
    if (createPanelNode === "itemType") {
      if (!panelValues.itemTypeVendor.trim()) { setPanelError("Vendor is required."); return; }
    }
    if (createPanelNode === "message") {
      if (!panelValues.msgItemType.trim()) { setPanelError("Item Type is required."); return; }
      if (!panelValues.msgCommPolicy.trim()) { setPanelError("Communication Policy is required."); return; }
      if (!panelValues.topic.trim()) { setPanelError("Topic is required."); return; }
    }
    if (createPanelNode === "communication") {
      if (!panelValues.groupName.trim()) { setPanelError("Group Name is required."); return; }
      if (!panelValues.commItemType.trim()) { setPanelError("Item Type is required."); return; }
      if (!panelValues.protocol.trim()) { setPanelError("Protocol is required."); return; }
      if (!panelValues.messageFormat.trim()) { setPanelError("Message Format is required."); return; }
      if (!panelValues.centric.trim()) { setPanelError("Centric is required."); return; }
    }

    setPanelSaving(true);
    setPanelError(null);

    try {
      // ── Vendor ──────────────────────────────────────────────────────────────
      if (createPanelNode === "vendor") {
        await onCreateVendor({
          name,
          description:    panelValues.description.trim()    || undefined,
          type:           panelValues.type.trim()           || undefined,
          industry:       panelValues.industry.trim()       || undefined,
          authType:       panelValues.authType.trim()       || undefined,
          clientId:       panelValues.clientId.trim()       || undefined,
          clientSecret:   panelValues.clientSecret.trim()   || undefined,
          authorizationUrl: panelValues.authorizationUrl.trim() || undefined,
          tokenUrl:       panelValues.tokenUrl.trim()       || undefined,
          redirectUri:    panelValues.redirectUri.trim()    || undefined,
          tokenType:      panelValues.tokenType.trim()      || undefined,
          apiToken:       panelValues.apiToken.trim()       || undefined,
          jwtToken:       panelValues.jwtToken.trim()       || undefined,
          certificate:    panelValues.certificate.trim()    || undefined,
          publicKey:      panelValues.publicKey.trim()      || undefined,
          privateKey:     panelValues.privateKey.trim()     || undefined,
        });
        onValueChange("vendorName", name);
      }

      // ── Parameter ────────────────────────────────────────────────────────────
      if (createPanelNode === "parameter") {
        await onCreateParameter({
          name,
          vendors:      panelValues.paramVendor.trim() || undefined,
          variableType: panelValues.variableType || "STRING",
          isConstant:   panelValues.isConstant === "true",
          pinType:      panelValues.pinType.trim() || undefined,
          pinCount:     panelValues.pinCount ? Number(panelValues.pinCount) : undefined,
        });
      }

      // ── Item Type ────────────────────────────────────────────────────────────
      if (createPanelNode === "itemType") {
        await onCreateItemType({
          name,
          description:    panelValues.description.trim() || undefined,
          vendorName:     panelValues.itemTypeVendor.trim() || undefined,
          synonyms:       panelValues.synonyms.trim() || undefined,
          parameterNames: panelValues.itemTypeParams.trim() || undefined,
        });
        onValueChange("itemTypeName", name);
      }

      // ── Communication ────────────────────────────────────────────────────────
      if (createPanelNode === "communication") {
        await onCreateCommunication({
          name,
          groupName:    panelValues.groupName.trim() || "default",
          itemType:     panelValues.commItemType.trim() || "generic",
          protocol:     panelValues.protocol || "MQTT",
          messageFormat: panelValues.messageFormat || "JSON",
          centric:      panelValues.centric || "TOPIC",
          icon:         panelValues.icon || "Device",
          version:      panelValues.version.trim() || undefined,
          communicationMethod: panelValues.communicationMethod.trim() || undefined,
          needFirmware: panelValues.needFirmware === "true",
          messageStructure: panelValues.messageStructure.trim() || undefined,
          needConfirmation: panelValues.needConfirmation === "true",
          confirmationMessageStructure: panelValues.confirmationMessageStructure.trim() || undefined,
          payloadTopics: panelValues.payloadTopics.trim().replace(/\n+/g, ",") || undefined,
        });
        onValueChange("communicationPolicy", name);
      }

      // ── Message ──────────────────────────────────────────────────────────────
      if (createPanelNode === "message") {
        const msgName = name || `${panelValues.msgItemType}_${panelValues.msgCommPolicy}`.toLowerCase().replace(/[\s-]+/g, "_");
        await onCreateMessage({
          name:           msgName,
          itemType:       panelValues.msgItemType,
          communicationPolicy: panelValues.msgCommPolicy,
          scope:          panelValues.scope || "DEVICE",
          topic:          panelValues.topic.trim(),
          messageType:    panelValues.messageType || undefined,
          policyType:     panelValues.policyType || undefined,
          commandType:    panelValues.commandType.trim() || undefined,
          isPayloadCentric:  panelValues.isPayloadCentric === "true",
          topicUnique:    panelValues.topicUnique === "true",
          loggedMessage:  panelValues.loggedMessage === "true",
          retainMessages: panelValues.retainMessages === "true",
          requestPayloadFormat: panelValues.requestPayloadFormat.trim() || undefined,
          responsePayloadFormat: panelValues.responsePayloadFormat.trim() || undefined,
          qos:            panelValues.qos !== "" ? Number(panelValues.qos) : undefined,
          pollingInterval: panelValues.pollingInterval ? Number(panelValues.pollingInterval) : undefined,
        });
        onValueChange("messageName", msgName);
      }

      // ── Item ─────────────────────────────────────────────────────────────────
      if (createPanelNode === "item") {
        const vendor = String(values.vendorName ?? "").trim();
        const itemType = String(values.itemTypeName ?? "").trim();
        const communicationPolicy = String(values.communicationPolicy ?? "").trim();
        if (!vendor || !itemType || !communicationPolicy) {
          throw new Error("Select vendor, item type, and communication policy before creating an item.");
        }
        const itemCode = panelValues.itemCode.trim() || name.replace(/\s+/g, "_").toUpperCase();
        await onCreateItem({
          name,
          itemCode,
          vendor,
          itemType,
          communicationPolicy,
          description:     panelValues.description.trim()     || undefined,
          metadata:        panelValues.metadata.trim()        || undefined,
          itemPollingConfig: panelValues.itemPollingConfig.trim() || undefined,
          secureItem:      panelValues.secureItem === "true",
          gateway:         panelValues.gateway.trim()         || undefined,
        });
        onValueChange("itemName", name);
        onValueChange("itemCode", itemCode);
      }

      closeCreatePanel();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Failed to create record");
    } finally {
      setPanelSaving(false);
    }
  };

  const deviceSummary = [
    String(values.name ?? "").trim(),
    String(values.serialNumber ?? "").trim(),
    String(values.connectionType ?? "").trim(),
    String(values.project ?? "").trim(),
  ].filter(Boolean).join(" | ");

  // ── Panel renderer ──────────────────────────────────────────────────────────

  const renderContextPanel = (node: WorkflowNode, mode: "create" | "select") => (
    <div className="w-full rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-sky-50/80 to-indigo-50/80 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {mode === "create"
              ? node === "device" ? "Configure Device" : `Add ${activeNodeTitle}`
              : `Available ${activeNodeTitle}`}
          </p>
          <p className="mt-1 text-[12px] text-slate-600">
            {mode === "create"
              ? node === "device"
                ? "Fill device fields and apply to the workflow."
                : "Fill input fields and create a new record."
              : node === "device"
                ? "Device details are configured from + on the Device box."
                : "Click an entry to select it for this node."}
          </p>
        </div>
        <button type="button" onClick={closeContextPanel}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={15} />
        </button>
      </div>

      {mode === "create" ? (
        <>
          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">

            {/* ── Name (all nodes except message, which has no name field) ── */}
            {node !== "message" && (
              <Field label="Name" required>
                <input value={panelValues.name} onChange={set("name")}
                  className={inputClass} placeholder="Enter name" />
              </Field>
            )}

            {/* ═══════════════ VENDOR ═══════════════ */}
            {node === "vendor" && (
              <>
                <Field label="Description">
                  <textarea value={panelValues.description} onChange={set("description")}
                    className={`${inputClass} min-h-[72px] py-2`} placeholder="Enter vendor description" />
                </Field>

                <Field label="Industry" required>
                  <select value={panelValues.industry} onChange={set("industry")} className={inputClass}>
                    <option value="">Select an Industry</option>
                    {VENDOR_INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>

                {/* Advanced Options — collapsible, matches VendorForm */}
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setPanelValues((p) => ({ ...p, showAdvanced: p.showAdvanced === "true" ? "false" : "true" }))}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-600">
                      Advanced Options
                      {panelValues.showAdvanced !== "true" && (
                        <span className="ml-1 font-normal text-slate-400">(Optional)</span>
                      )}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {panelValues.showAdvanced === "true" ? "▲" : "▶"}
                    </span>
                  </button>

                  {panelValues.showAdvanced === "true" && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <Field label="Auth Type">
                        <select value={panelValues.authType} onChange={set("authType")} className={inputClass}>
                          <option value="">Select auth type</option>
                          <option>OAUTH2</option>
                          <option>Credentials</option>
                          <option>JWT</option>
                          <option>Certificate</option>
                        </select>
                      </Field>

                      {panelValues.authType === "OAUTH2" && (
                        <>
                          <Field label="Client ID">
                            <input value={panelValues.clientId} onChange={set("clientId")} className={inputClass} placeholder="e.g. hello@iotiq.co.in" />
                          </Field>
                          <Field label="Client Secret">
                            <input type="password" value={panelValues.clientSecret} onChange={set("clientSecret")} className={inputClass} autoComplete="new-password" />
                          </Field>
                          <Field label="Authorization URL">
                            <input value={panelValues.authorizationUrl} onChange={set("authorizationUrl")} className={inputClass} placeholder="e.g. https://example.com/oauth/authorize" />
                          </Field>
                          <Field label="Token URL">
                            <input value={panelValues.tokenUrl} onChange={set("tokenUrl")} className={inputClass} placeholder="e.g. https://example.com/oauth/token" />
                          </Field>
                          <Field label="Redirect URI">
                            <input value={panelValues.redirectUri} onChange={set("redirectUri")} className={inputClass} placeholder="e.g. https://example.com/oauth/callback" />
                          </Field>
                        </>
                      )}

                      {panelValues.authType === "Credentials" && (
                        <>
                          <Field label="Token Type">
                            <select value={panelValues.tokenType} onChange={set("tokenType")} className={inputClass}>
                              <option>Bearer</option>
                              <option>MAC</option>
                            </select>
                          </Field>
                          <Field label="API Token">
                            <input type="password" value={panelValues.apiToken} onChange={set("apiToken")} className={inputClass} placeholder="Enter API token" autoComplete="new-password" />
                          </Field>
                        </>
                      )}

                      {panelValues.authType === "JWT" && (
                        <Field label="JWT Token">
                          <input type="password" value={panelValues.jwtToken} onChange={set("jwtToken")} className={inputClass} placeholder="Enter JWT token" autoComplete="new-password" />
                        </Field>
                      )}

                      {panelValues.authType === "Certificate" && (
                        <>
                          <Field label="Certificate">
                            <p className="text-[11px] text-slate-400 -mt-1">Enter the Certificate in PEM format</p>
                            <textarea value={panelValues.certificate} onChange={set("certificate")}
                              className={`${inputClass} min-h-[80px] py-2 font-mono text-[11px]`} placeholder="-----BEGIN CERTIFICATE-----" />
                          </Field>
                          <Field label="Public Key">
                            <p className="text-[11px] text-slate-400 -mt-1">Enter the Public Key in PEM format</p>
                            <textarea value={panelValues.publicKey} onChange={set("publicKey")}
                              className={`${inputClass} min-h-[80px] py-2 font-mono text-[11px]`} placeholder="-----BEGIN PUBLIC KEY-----" />
                          </Field>
                          <Field label="Private Key">
                            <p className="text-[11px] text-slate-400 -mt-1">Enter the Private Key in PEM format</p>
                            <textarea value={panelValues.privateKey} onChange={set("privateKey")}
                              className={`${inputClass} min-h-[80px] py-2 font-mono text-[11px]`} placeholder="-----BEGIN PRIVATE KEY-----" />
                          </Field>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════ PARAMETER ═══════════════ */}
            {node === "parameter" && (
              <>
                <Field label="Vendors" required>
                  <select value={panelValues.paramVendor} onChange={set("paramVendor")} className={inputClass}>
                    <option value="">Select a vendor</option>
                    {vendorOptions.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>

                {/* Variable Type + Is Constant on same row */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[12px] font-medium text-slate-600">
                      Variable Type<span className="ml-1 text-rose-500">*</span>
                    </p>
                    <select value={panelValues.variableType} onChange={set("variableType")} className={inputClass}>
                      {VARIABLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col items-center gap-1 pb-1">
                    <p className="text-[12px] font-medium text-slate-600 whitespace-nowrap">Is Constant</p>
                    <button
                      type="button"
                      onClick={() => setPanelValues((p) => ({ ...p, isConstant: p.isConstant === "true" ? "false" : "true" }))}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        panelValues.isConstant === "true" ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        panelValues.isConstant === "true" ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Advanced Options — collapsible */}
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setPanelValues((p) => ({ ...p, showAdvanced: p.showAdvanced === "true" ? "false" : "true" }))}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-600">
                      Advanced Options
                      {panelValues.showAdvanced !== "true" && (
                        <span className="ml-1 font-normal text-slate-400">(Optional)</span>
                      )}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {panelValues.showAdvanced === "true" ? "▲" : "▶"}
                    </span>
                  </button>

                  {panelValues.showAdvanced === "true" && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <Field label="Pin Count">
                        <input type="number" min={0} value={panelValues.pinCount} onChange={set("pinCount")}
                          className={inputClass} placeholder="0" />
                      </Field>
                      <Field label="Pin Type">
                        <select value={panelValues.pinType} onChange={set("pinType")} className={inputClass}>
                          <option value="">None</option>
                          <option>DIGITAL</option>
                          <option>ANALOG</option>
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════ ITEM TYPE ═══════════════ */}
            {node === "itemType" && (
              <>
                <Field label="Description">
                  <textarea value={panelValues.description} onChange={set("description")}
                    className={`${inputClass} min-h-[72px] py-2`} placeholder="Enter Item Type Description" />
                </Field>

                <Field label="Synonyms">
                  <input value={panelValues.synonyms} onChange={set("synonyms")}
                    className={inputClass} placeholder="Add Synonym and Click Enter" />
                </Field>

                {/* Vendors* — select + removable chip */}
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium text-slate-600">
                    Vendors<span className="ml-1 text-rose-500">*</span>
                  </p>
                  <select value={panelValues.itemTypeVendor} onChange={set("itemTypeVendor")} className={inputClass}>
                    <option value="">{vendorsLoading ? "Loading vendors…" : "Select Vendors…"}</option>
                    {vendorOptions.map((v) => <option key={v}>{v}</option>)}
                  </select>
                  {panelValues.itemTypeVendor && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                      <span className="text-[12px] text-slate-700">{panelValues.itemTypeVendor}</span>
                      <button type="button"
                        onClick={() => setPanelValues((p) => ({ ...p, itemTypeVendor: "", itemTypeParams: "" }))}
                        className="text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Parameters* — multi-select with removable chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-slate-600">
                      Parameters<span className="ml-1 text-rose-500">*</span>
                    </p>
                    {panelValues.itemTypeParams && (
                      <button type="button"
                        onClick={() => setPanelValues((p) => ({ ...p, itemTypeParams: "" }))}
                        className="text-[11px] text-rose-500 hover:text-rose-600">
                        Clear All
                      </button>
                    )}
                  </div>
                  <select
                    value=""
                    disabled={!panelValues.itemTypeVendor || parametersLoading}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setPanelValues((p) => {
                        const current = p.itemTypeParams ? p.itemTypeParams.split(",").map((s) => s.trim()).filter(Boolean) : [];
                        if (current.includes(val)) return p;
                        return { ...p, itemTypeParams: [...current, val].join(",") };
                      });
                    }}
                    className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <option value="">
                      {!panelValues.itemTypeVendor
                        ? "Select vendor first"
                        : parametersLoading
                          ? "Loading parameters…"
                          : (() => {
                              const n = panelValues.itemTypeParams ? panelValues.itemTypeParams.split(",").filter(Boolean).length : 0;
                              return n > 0 ? `${n} parameter${n > 1 ? "s" : ""} selected` : "Select parameter";
                            })()}
                    </option>
                    {parameterOptions
                      .filter((p) => !panelValues.itemTypeParams.split(",").map((s) => s.trim()).includes(p))
                      .map((p) => <option key={p}>{p}</option>)}
                  </select>
                  {panelValues.itemTypeParams && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {panelValues.itemTypeParams.split(",").map((s) => s.trim()).filter(Boolean).map((param) => (
                        <div key={param} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                          <span className="text-[11px] font-medium text-slate-700">{param}</span>
                          <button type="button"
                            onClick={() => setPanelValues((p) => ({
                              ...p,
                              itemTypeParams: p.itemTypeParams.split(",").map((s) => s.trim()).filter((s) => s && s !== param).join(","),
                            }))}
                            className="text-slate-400 hover:text-rose-500">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════ COMMUNICATION ═══════════════ */}
            {node === "communication" && (() => {
              const itSet = panelValues.commItemType.trim() !== "";
              const prSet = itSet && panelValues.protocol.trim() !== "";
              const mfSet = prSet && panelValues.messageFormat.trim() !== "";
              const ctSet = mfSet && panelValues.centric.trim() !== "";
              const centric = panelValues.centric;
              const isPayload = centric === "PAYLOAD";
              const isHybrid  = centric === "HYBRID";
              const showTopicPart   = ctSet && !isPayload;          // TOPIC + HYBRID
              const showPayloadPart = ctSet && (isPayload || isHybrid); // PAYLOAD + HYBRID
              const needConf = panelValues.needConfirmation === "true";

              const ToggleBtn = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
                <button type="button" onClick={onToggle}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${on ? "bg-slate-900" : "bg-slate-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${on ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              );

              const StructArea = ({ value, onChange, placeholder }: { value: string; onChange: React.ChangeEventHandler<HTMLTextAreaElement>; placeholder: string }) => (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="flex">
                    <div className="w-7 shrink-0 bg-slate-50 pt-2.5 text-center text-[11px] font-medium text-slate-400">1</div>
                    <textarea value={value} onChange={onChange} rows={4}
                      className="w-full resize-y border-0 px-2.5 py-2.5 text-[12px] font-mono text-slate-800 outline-none focus:ring-0"
                      placeholder={placeholder} />
                  </div>
                </div>
              );

              const ToggleRow = ({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) => (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <span className="flex-1 text-[12px] text-slate-500">{label}</span>
                  <ToggleBtn on={on} onToggle={onToggle} />
                </div>
              );

              return (
                <>
                  {/* Icon */}
                  <Field label="Icon" required>
                    <select value={panelValues.icon} onChange={set("icon")} className={inputClass}>
                      {ICON_OPTIONS.map((i) => <option key={i}>{i}</option>)}
                    </select>
                  </Field>

                  {/* Group Name */}
                  <Field label="Group Name" required>
                    <input value={panelValues.groupName} onChange={set("groupName")}
                      className={inputClass} placeholder="Enter Group Name (unique across cluster)" />
                  </Field>

                  {/* Firmware toggle */}
                  <ToggleRow
                    label="Need us to provide firmware?"
                    on={panelValues.needFirmware === "true"}
                    onToggle={() => setPanelValues((p) => ({ ...p, needFirmware: p.needFirmware === "true" ? "false" : "true" }))}
                  />

                  {/* Item Type */}
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-medium text-slate-600">
                      Item Type<span className="ml-1 text-rose-500">*</span>
                    </p>
                    <select value={panelValues.commItemType}
                      onChange={(e) => { const v = e.target.value; setPanelValues((p) => ({ ...p, commItemType: v, protocol: "", messageFormat: "", centric: "", messageStructure: "", confirmationMessageStructure: "", needConfirmation: "false", payloadTopics: "" })); }}
                      className={inputClass}>
                      <option value="">{itemTypesLoading ? "Loading item types…" : "Select Item Types…"}</option>
                      {itemTypeOptions.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {panelValues.commItemType && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                        <span className="text-[11px] text-slate-700">{panelValues.commItemType}</span>
                      </div>
                    )}
                  </div>

                  {/* Protocol — after Item Type */}
                  {itSet && (
                    <Field label="Protocol" required>
                      <select value={panelValues.protocol}
                        onChange={(e) => { const v = e.target.value; setPanelValues((p) => ({ ...p, protocol: v, messageFormat: "", centric: "", messageStructure: "", confirmationMessageStructure: "", needConfirmation: "false", payloadTopics: "" })); }}
                        className={inputClass}>
                        <option value="">Select a Protocol</option>
                        <option>MQTT</option><option>HTTP</option><option>WEBSOCKET</option>
                      </select>
                    </Field>
                  )}

                  {/* Message Format — after Protocol */}
                  {prSet && (
                    <Field label="Message Format" required>
                      <select value={panelValues.messageFormat}
                        onChange={(e) => { const v = e.target.value; setPanelValues((p) => ({ ...p, messageFormat: v, centric: "", messageStructure: "", confirmationMessageStructure: "", needConfirmation: "false", payloadTopics: "" })); }}
                        className={inputClass}>
                        <option value="">Select a Message Format (JSON or ARRAY)</option>
                        <option>JSON</option><option>ARRAY</option>
                      </select>
                    </Field>
                  )}

                  {/* Centric — after Message Format */}
                  {mfSet && (
                    <Field label="Centric" required>
                      <select value={panelValues.centric}
                        onChange={(e) => { const v = e.target.value; setPanelValues((p) => ({ ...p, centric: v, messageStructure: "", confirmationMessageStructure: "", needConfirmation: v === "PAYLOAD" ? "true" : "false", payloadTopics: "" })); }}
                        className={inputClass}>
                        <option value="">Select Centric (TOPIC, PAYLOAD, HYBRID)</option>
                        <option>TOPIC</option><option>PAYLOAD</option><option>HYBRID</option>
                      </select>
                    </Field>
                  )}

                  {/* TOPIC / HYBRID — Message Structure + confirmation toggle */}
                  {showTopicPart && (
                    <>
                      <div className="space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">
                          Message Structure<span className="ml-1 text-rose-500">*</span>
                        </p>
                        <StructArea value={panelValues.messageStructure} onChange={set("messageStructure")}
                          placeholder='{"deviceid":"","status":""}' />
                      </div>

                      <ToggleRow
                        label="Need confirmation message structure if you want Toggle on/off?"
                        on={needConf}
                        onToggle={() => setPanelValues((p) => ({ ...p, needConfirmation: p.needConfirmation === "true" ? "false" : "true", confirmationMessageStructure: p.needConfirmation === "true" ? "" : p.confirmationMessageStructure }))}
                      />

                      {needConf && !isHybrid && (
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-slate-600">
                            Confirmation Message Structure<span className="ml-1 text-rose-500">*</span>
                          </p>
                          <StructArea value={panelValues.confirmationMessageStructure} onChange={set("confirmationMessageStructure")}
                            placeholder='{"status":"ok"}' />
                        </div>
                      )}
                    </>
                  )}

                  {/* PAYLOAD / HYBRID — Payload Topics + Payload Message Structure */}
                  {showPayloadPart && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-medium text-slate-600">
                            Payload Centric Topics<span className="ml-1 text-rose-500">*</span>
                          </p>
                          <button type="button"
                            onClick={() => setPanelValues((p) => ({ ...p, payloadTopics: p.payloadTopics ? p.payloadTopics + "\n" : "" }))}
                            className="text-[12px] text-slate-600 hover:text-slate-900">
                            ⊕ Add Topic
                          </button>
                        </div>
                        {(panelValues.payloadTopics ? panelValues.payloadTopics.split("\n") : [""]).map((topic, i) => (
                          <input key={i} type="text" value={topic} required={i === 0}
                            onChange={(e) => {
                              const lines = panelValues.payloadTopics ? panelValues.payloadTopics.split("\n") : [""];
                              lines[i] = e.target.value;
                              setPanelValues((p) => ({ ...p, payloadTopics: lines.join("\n") }));
                            }}
                            className={inputClass} placeholder="Enter Topic" />
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">Payload Centric Message Structure</p>
                        <StructArea value={panelValues.messageStructure} onChange={set("messageStructure")}
                          placeholder='{"deviceid":"","status":""}' />
                      </div>

                      <ToggleRow
                        label={isPayload ? "Confirmation message structures will be required" : "Confirmation message structures will be optional"}
                        on={needConf}
                        onToggle={() => setPanelValues((p) => ({ ...p, needConfirmation: p.needConfirmation === "true" ? "false" : "true" }))}
                      />

                      {needConf && (
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-slate-600">
                            {isPayload ? "Payload Centric Confirmation Message Structure" : "Confirmation Message Structure"}
                            <span className="ml-1 text-rose-500">*</span>
                          </p>
                          <StructArea value={panelValues.confirmationMessageStructure} onChange={set("confirmationMessageStructure")}
                            placeholder='{"status":"ok"}' />
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}

            {/* ═══════════════ MESSAGE ═══════════════ */}
            {node === "message" && (() => {
              const hasItemType  = panelValues.msgItemType.trim() !== "";
              const hasCommPolicy = hasItemType && panelValues.msgCommPolicy.trim() !== "";
              const showRem = hasItemType && hasCommPolicy;

              const MsgToggle = ({ stateKey }: { stateKey: string }) => (
                <button type="button"
                  onClick={() => setPanelValues((p) => ({ ...p, [stateKey]: p[stateKey] === "true" ? "false" : "true" }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${panelValues[stateKey] === "true" ? "bg-slate-900" : "bg-slate-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${panelValues[stateKey] === "true" ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              );

              return (
                <>
                  {/* Item Type */}
                  <Field label="Item Type" required>
                    <select value={panelValues.msgItemType}
                      onChange={(e) => { const v = e.target.value; setPanelValues((p) => ({ ...p, msgItemType: v, msgCommPolicy: "" })); }}
                      className={inputClass}>
                      <option value="">{itemTypesLoading ? "Loading item types…" : "Select Item Types…"}</option>
                      {itemTypeOptions.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>

                  {/* Communication Policy — disabled until Item Type selected */}
                  <Field label="Communication Policy" required>
                    <select value={panelValues.msgCommPolicy} onChange={set("msgCommPolicy")}
                      disabled={!hasItemType || communicationPoliciesLoading}
                      className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}>
                      <option value="">
                        {!hasItemType
                          ? "Select an item first to choose communication policy"
                          : communicationPoliciesLoading ? "Loading…" : "Select communication policy"}
                      </option>
                      {communicationPolicyOptions.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    {panelValues.msgCommPolicy && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                        <span className="text-[11px] text-slate-700">{panelValues.msgCommPolicy}</span>
                      </div>
                    )}
                  </Field>

                  {/* Progressive: show rest after both selected */}
                  {showRem && (
                    <>
                      {/* Scope */}
                      <Field label="Scope" required>
                        <select value={panelValues.scope} onChange={set("scope")} className={inputClass}>
                          <option>DEVICE</option>
                          <option>GROUP</option>
                          <option>ALL</option>
                        </select>
                      </Field>

                      {/* Topic + Is Topic Unique toggle on same row */}
                      <div className="space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">Topic</p>
                        <div className="flex items-start gap-2">
                          <input value={panelValues.topic} onChange={set("topic")}
                            className={`${inputClass} flex-1`} placeholder="mqtt/device/@{deviceId}/" />
                          <div className="flex flex-col items-center gap-1 pt-1.5">
                            <p className="text-[10px] font-medium text-slate-500 text-center leading-tight">Is Topic<br />Unique</p>
                            <MsgToggle stateKey="topicUnique" />
                          </div>
                        </div>
                      </div>

                      {/* Message Type */}
                      <Field label="Message Type" required>
                        <select value={panelValues.messageType} onChange={set("messageType")} className={inputClass}>
                          <option value="">Select Message Type</option>
                          {MESSAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </Field>

                      {/* Logged Message toggle row */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700">Logged Message</p>
                          <p className="text-[11px] text-slate-400">Enable to log all messages for this policy.</p>
                        </div>
                        <MsgToggle stateKey="loggedMessage" />
                      </div>

                      {/* Retain Message toggle row */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700">Retain Message</p>
                          <p className="text-[11px] text-slate-400">Enable to retain the message for this policy.</p>
                        </div>
                        <MsgToggle stateKey="retainMessages" />
                      </div>

                      {/* Command Type */}
                      <Field label="Command Type" required>
                        <select value={panelValues.commandType} onChange={set("commandType")} className={inputClass}>
                          <option value="">Select Command Type</option>
                          <option>PUBLISH</option><option>SUBSCRIBE</option><option>POST</option><option>GET</option>
                        </select>
                      </Field>

                      {/* Policy Type */}
                      <Field label="Policy Type" required>
                        <select value={panelValues.policyType} onChange={set("policyType")} className={inputClass}>
                          <option value="">Select Policy Type</option>
                          <option>EXECUTE</option><option>QUERY</option><option>REGISTER</option>
                          <option>BOOT</option><option>SYNC</option><option>OTA</option>
                        </select>
                      </Field>

                      {/* Payload Format — single textarea with line numbers */}
                      <div className="space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">Payload Format</p>
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <div className="flex">
                            <div className="w-7 shrink-0 bg-slate-50 pt-2.5 text-center text-[11px] font-medium text-slate-400">1</div>
                            <textarea value={panelValues.requestPayloadFormat} onChange={set("requestPayloadFormat")}
                              rows={5} className="w-full resize-y border-0 px-2.5 py-2.5 text-[12px] font-mono text-slate-800 outline-none focus:ring-0"
                              placeholder={'{\n  "deviceid": "@{device.foreignId}"\n}'} />
                          </div>
                        </div>
                      </div>

                      {/* Advanced Options — collapsible, QOS + Polling side-by-side */}
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <button type="button"
                          onClick={() => setPanelValues((p) => ({ ...p, showAdvanced: p.showAdvanced === "true" ? "false" : "true" }))}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] transition hover:bg-slate-50">
                          <span className="font-medium text-slate-600">Advanced Options</span>
                          <span className="text-slate-400 text-[10px]">{panelValues.showAdvanced === "true" ? "▲" : "▼"}</span>
                        </button>
                        {panelValues.showAdvanced === "true" && (
                          <div className="border-t border-slate-200 bg-slate-50/50 p-3">
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="QOS">
                                <input type="number" min={0} value={panelValues.qos} onChange={set("qos")}
                                  className={inputClass} placeholder="0" />
                              </Field>
                              <Field label="Polling Interval">
                                <input type="number" min={0} value={panelValues.pollingInterval} onChange={set("pollingInterval")}
                                  className={inputClass} placeholder="0" />
                              </Field>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* ═══════════════ ITEM ═══════════════ */}
            {node === "item" && (
              <>
                <Field label="Item Code" required>
                  <input value={panelValues.itemCode} onChange={set("itemCode")}
                    className={inputClass} placeholder="AUTO_CODE" />
                </Field>
                <Field label="Description">
                  <textarea value={panelValues.description} onChange={set("description")}
                    className={`${inputClass} min-h-[72px] py-2`} placeholder="Enter description" />
                </Field>
                <Field label="Metadata (JSON)">
                  <textarea value={panelValues.metadata} onChange={set("metadata")}
                    className={`${inputClass} min-h-[56px] py-2 font-mono text-[11px]`} placeholder="{}" />
                </Field>
                <Field label="Item Polling Config (JSON)">
                  <textarea value={panelValues.itemPollingConfig} onChange={set("itemPollingConfig")}
                    className={`${inputClass} min-h-[56px] py-2 font-mono text-[11px]`} placeholder="{}" />
                </Field>
                <Field label="Secure Item">
                  <select value={panelValues.secureItem} onChange={set("secureItem")} className={inputClass}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
                <Field label="Gateway">
                  <select value={panelValues.gateway} onChange={set("gateway")} className={inputClass}>
                    <option value="">None</option>
                    <option>gateway_a</option><option>gateway_b</option><option>gateway_c</option>
                  </select>
                </Field>
              </>
            )}

            {/* ═══════════════ DEVICE ═══════════════ */}
            {node === "device" && (
              <>
                <Field label="Serial Number" required>
                  <input value={panelValues.serialNumber} onChange={set("serialNumber")}
                    className={inputClass} placeholder="Enter serial number" />
                </Field>
                <Field label="Connection Type" required>
                  <select value={panelValues.connectionType} onChange={set("connectionType")} className={inputClass}>
                    <option>MQTT</option><option>API</option><option>WEBSOCKET</option>
                    <option>BLUETOOTH</option><option>WIFI</option>
                  </select>
                </Field>
                <Field label="Project" required>
                  <select value={panelValues.project} onChange={set("project")} className={inputClass}>
                    <option>project_a</option><option>project_b</option>
                    <option>project_c</option><option>project_d</option>
                  </select>
                </Field>
                <Field label="Foreign ID">
                  <input value={panelValues.foreignId} onChange={set("foreignId")}
                    className={inputClass} placeholder="Optional external device ID" />
                </Field>
                <Field label="Gateway Foreign ID">
                  <input value={panelValues.gatewayForeignId} onChange={set("gatewayForeignId")}
                    className={inputClass} placeholder="Enter gateway foreign ID" />
                </Field>
                <Field label="Metadata (JSON)">
                  <textarea value={panelValues.metadata} onChange={set("metadata")}
                    className={`${inputClass} min-h-[56px] py-2 font-mono text-[11px]`} placeholder="{}" />
                </Field>
              </>
            )}

            {panelError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {panelError}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={closeContextPanel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={() => void createNodeRecord()} disabled={panelSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {node === "device" ? "Apply" : panelSaving ? "Saving…" : "Create"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 bg-white/90">
          {node === "device" ? (
            <p className="px-4 py-3 text-[12px] text-slate-500">
              Use the + button on the Device box to fill device details.
            </p>
          ) : activeLoading ? (
            <p className="px-4 py-3 text-[12px] text-slate-500">Loading…</p>
          ) : activeOptions.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-500">No records available.</p>
          ) : (
            <ul>
              {activeOptions.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => selectOption(entry.label)}
                    className="w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50">
                    <p className="text-[12px] font-medium text-slate-900">{entry.label}</p>
                    {entry.meta && <p className="mt-0.5 text-[11px] text-slate-500">{entry.meta}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  // ── Block button ────────────────────────────────────────────────────────────

  const renderBlock = (nodeKey: WorkflowNode, globalIndex: number) => {
    const nodeConfig = WORKFLOW_NODES[globalIndex];
    const selected = activeNode === nodeKey;
    const theme = NODE_THEME[nodeKey];
    const boundValue =
      nodeKey === "device"
        ? deviceSummary
        : nodeConfig.bindsTo
          ? String(values[nodeConfig.bindsTo] ?? "").trim()
          : "";

    return (
      <button type="button" onClick={() => handleNodeClick(nodeKey)}
        className={`relative h-28 w-full rounded-2xl px-4 text-left shadow-sm transition lg:h-36 ${
          selected ? theme.selected : theme.idle
        }`}>
        <span className={`absolute left-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${theme.badge}`}>
          {globalIndex + 1}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {nodeConfig.label}
        </span>
        <p className="mt-2 line-clamp-2 text-[12px] font-medium text-slate-900">
          {boundValue || "Not selected"}
        </p>
        <button type="button"
          onClick={(e) => { e.stopPropagation(); openCreatePanel(nodeKey); }}
          className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition ${theme.plus}`}
          aria-label={`Add ${nodeConfig.label}`}>
          <Plus size={14} />
        </button>
      </button>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 grid-cols-1">
        <div className="relative min-h-[76vh] overflow-x-auto overflow-y-visible rounded-3xl border border-blue-200/70 bg-gradient-to-br from-sky-50 via-indigo-50 to-cyan-50 p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-55" style={{
            backgroundImage: "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          <div className="relative">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Workflow Builder
            </p>

            <div className="mt-6">
              {/* Mobile / tablet: flat grid, panel below its block */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:hidden">
                {WORKFLOW_NODES.map((nodeConfig, index) => {
                  const isActive = panelNode === nodeConfig.key && panelMode !== null;
                  return (
                    <div key={nodeConfig.key} className="col-span-1 flex flex-col gap-3">
                      {renderBlock(nodeConfig.key, index)}
                      {isActive && renderContextPanel(nodeConfig.key, panelMode!)}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: one flex-row per logical row; panel inserts right after its block */}
              <div className="hidden lg:flex lg:flex-col lg:gap-10">
                {DESKTOP_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex items-start gap-6">
                    {rowIdx === 2 && <div className="flex-1" />}

                    {row.map((nodeKey) => {
                      const globalIndex = WORKFLOW_NODES.findIndex((n) => n.key === nodeKey);
                      const isActive = panelNode === nodeKey && panelMode !== null;
                      return (
                        <Fragment key={nodeKey}>
                          <div className="flex-1 min-w-0">
                            {renderBlock(nodeKey, globalIndex)}
                          </div>
                          {isActive && (
                            <div className="w-[300px] flex-shrink-0">
                              {renderContextPanel(nodeKey, panelMode!)}
                            </div>
                          )}
                        </Fragment>
                      );
                    })}

                    {rowIdx === 2 && !(panelNode === "device" && panelMode !== null) && (
                      <div className="flex-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasInteraction && submitError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700">
          {submitError}
        </p>
      )}

      {hasInteraction && (
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={isSaving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {isSaving ? "Saving…" : editing ? "Save Device" : "Create Device"}
          </button>
        </div>
      )}
    </form>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <p className="text-[12px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </p>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
