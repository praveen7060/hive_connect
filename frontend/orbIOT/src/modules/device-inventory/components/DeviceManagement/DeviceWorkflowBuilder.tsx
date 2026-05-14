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
  onSubmit: (event: React.FormEvent) => void;
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

const WORKFLOW_NODES: Array<{ key: WorkflowNode; label: string; bindsTo: string | null }> = [
  { key: "vendor", label: "Vendor", bindsTo: "vendorName" },
  { key: "parameter", label: "Parameter", bindsTo: "parameterName" },
  { key: "itemType", label: "Item Type", bindsTo: "itemTypeName" },
  { key: "communication", label: "Communication", bindsTo: "communicationPolicy" },
  { key: "message", label: "Message", bindsTo: "messageName" },
  { key: "item", label: "Item", bindsTo: "itemName" },
  { key: "device", label: "Device", bindsTo: "name" },
];

// Desktop layout: rows of blocks; panel inserts right after its block in the same row.
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

function emptyPanelState() {
  return {
    name: "",
    description: "",
    variableType: "string",
    pinType: "",
    topic: "mqtt/device/{{thingName}}/control",
    itemCode: "",
    serialNumber: "",
    connectionType: "MQTT",
    project: "project_a",
  };
}

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

  const activeOptions = useMemo<ActiveOption[]>(() => {
    if (!activeNode || activeNode === "device") return [];
    if (activeNode === "vendor") return vendorOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "parameter") return parameterOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "itemType") return itemTypeOptions.map((name) => ({ id: name, label: name }));
    if (activeNode === "communication") {
      return communicationPolicyOptions.map((name) => ({ id: name, label: name }));
    }
    if (activeNode === "message") {
      return messageOptions.map((entry) => ({
        id: entry.id,
        label: entry.name,
        meta: entry.topic ? `Topic: ${entry.topic}` : "",
      }));
    }
    return itemOptions.map((entry) => ({
      id: entry.id,
      label: entry.name,
      meta: entry.itemCode ? `Code: ${entry.itemCode}` : "",
    }));
  }, [
    activeNode,
    communicationPolicyOptions,
    itemOptions,
    itemTypeOptions,
    messageOptions,
    parameterOptions,
    vendorOptions,
  ]);

  const activeNodeTitle = WORKFLOW_NODES.find((n) => n.key === panelNode)?.label ?? "Box";
  const activeLoading = panelNode
    ? (panelNode === "vendor" && vendorsLoading) ||
      (panelNode === "parameter" && parametersLoading) ||
      (panelNode === "itemType" && itemTypesLoading) ||
      (panelNode === "communication" && communicationPoliciesLoading) ||
      (panelNode === "message" && messagesLoading)
    : false;

  const selectOption = (value: string) => {
    if (!activeNode) return;
    if (activeNode === "vendor") onValueChange("vendorName", value);
    if (activeNode === "parameter") onValueChange("parameterName", value);
    if (activeNode === "itemType") onValueChange("itemTypeName", value);
    if (activeNode === "communication") onValueChange("communicationPolicy", value);
    if (activeNode === "message") onValueChange("messageName", value);

    if (activeNode === "item") {
      const selected = itemOptions.find((entry) => entry.name === value);
      if (!selected) return;
      onValueChange("itemName", selected.name);
      onValueChange("itemCode", selected.itemCode);
      if (selected.vendor) onValueChange("vendorName", selected.vendor);
      if (selected.itemType) onValueChange("itemTypeName", selected.itemType);
      if (selected.communicationPolicy)
        onValueChange("communicationPolicy", selected.communicationPolicy);
    }
  };

  const openCreatePanel = (node: WorkflowNode) => {
    setCreatePanelNode(node);
    setActiveNode(node);
    setPanelError(null);
    setPanelValues({
      ...emptyPanelState(),
      name:
        node === "item"
          ? String(values.itemName ?? "")
          : node === "device"
            ? String(values.name ?? "")
            : "",
      itemCode: node === "item" ? String(values.itemCode ?? "") : "",
      serialNumber: node === "device" ? String(values.serialNumber ?? "") : "",
      connectionType: node === "device" ? String(values.connectionType ?? "MQTT") : "MQTT",
      project: node === "device" ? String(values.project ?? "project_a") : "project_a",
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
    return true;
  };

  const createNodeRecord = async () => {
    if (!createPanelNode) return;
    if (createPanelNode === "device") {
      if (applyDeviceFields()) closeCreatePanel();
      return;
    }

    const name = panelValues.name.trim();
    if (!name) {
      setPanelError("Name is required.");
      return;
    }

    setPanelSaving(true);
    setPanelError(null);

    try {
      if (createPanelNode === "vendor") {
        await onCreateVendor({ name, description: panelValues.description.trim() || undefined });
        onValueChange("vendorName", name);
      }
      if (createPanelNode === "parameter") {
        await onCreateParameter({
          name,
          vendors: String(values.vendorName ?? "").trim() || undefined,
          variableType: panelValues.variableType.trim() || "string",
          pinType: panelValues.pinType.trim() || undefined,
        });
      }
      if (createPanelNode === "itemType") {
        await onCreateItemType({
          name,
          description: panelValues.description.trim() || undefined,
          vendorName: String(values.vendorName ?? "").trim() || undefined,
        });
        onValueChange("itemTypeName", name);
      }
      if (createPanelNode === "communication") {
        await onCreateCommunication({
          name,
          groupName: String(values.vendorName ?? "").trim() || "default",
          itemType: String(values.itemTypeName ?? "").trim() || "generic",
          protocol: "MQTT",
          messageFormat: "JSON",
          centric: "TOPIC",
          icon: "radio",
        });
        onValueChange("communicationPolicy", name);
      }
      if (createPanelNode === "message") {
        const itemType = String(values.itemTypeName ?? "").trim();
        const communicationPolicy = String(values.communicationPolicy ?? "").trim();
        if (!itemType || !communicationPolicy) {
          throw new Error(
            "Select item type and communication policy before creating a message.",
          );
        }
        await onCreateMessage({
          name,
          itemType,
          communicationPolicy,
          topic: panelValues.topic.trim() || "mqtt/device/{{thingName}}/control",
          messageType: "UPDATE",
          policyType: "EXECUTE",
          communicationMethod: "PUBLISH",
        });
        onValueChange("messageName", name);
      }
      if (createPanelNode === "item") {
        const vendor = String(values.vendorName ?? "").trim();
        const itemType = String(values.itemTypeName ?? "").trim();
        const communicationPolicy = String(values.communicationPolicy ?? "").trim();
        if (!vendor || !itemType || !communicationPolicy) {
          throw new Error(
            "Select vendor, item type, and communication policy before creating an item.",
          );
        }
        const itemCode =
          panelValues.itemCode.trim() || name.replace(/\s+/g, "_").toUpperCase();
        await onCreateItem({ name, itemCode, vendor, itemType, communicationPolicy });
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
  ]
    .filter(Boolean)
    .join(" | ");

  const renderContextPanel = (node: WorkflowNode, mode: "create" | "select") => (
    <div className="w-full rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-sky-50/80 to-indigo-50/80 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {mode === "create"
              ? node === "device"
                ? "Configure Device"
                : `Add ${activeNodeTitle}`
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
        <button
          type="button"
          onClick={closeContextPanel}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={15} />
        </button>
      </div>

      {mode === "create" ? (
        <>
          <div className="mt-4 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            <Field label="Name" required>
              <input
                value={panelValues.name}
                onChange={(e) => setPanelValues((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
                placeholder="Enter name"
              />
            </Field>

            {node === "device" && (
              <>
                <Field label="Serial Number" required>
                  <input
                    value={panelValues.serialNumber}
                    onChange={(e) =>
                      setPanelValues((p) => ({ ...p, serialNumber: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Enter serial number"
                  />
                </Field>
                <Field label="Connection Type" required>
                  <select
                    value={panelValues.connectionType}
                    onChange={(e) =>
                      setPanelValues((p) => ({ ...p, connectionType: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="MQTT">MQTT</option>
                    <option value="API">API</option>
                    <option value="WEBSOCKET">WEBSOCKET</option>
                    <option value="WIFI">WIFI</option>
                  </select>
                </Field>
                <Field label="Project" required>
                  <input
                    value={panelValues.project}
                    onChange={(e) => setPanelValues((p) => ({ ...p, project: e.target.value }))}
                    className={inputClass}
                    placeholder="project_a"
                  />
                </Field>
              </>
            )}

            {(node === "vendor" || node === "itemType") && (
              <Field label="Description">
                <textarea
                  value={panelValues.description}
                  onChange={(e) =>
                    setPanelValues((p) => ({ ...p, description: e.target.value }))
                  }
                  className={`${inputClass} min-h-[86px] py-2`}
                  placeholder="Optional description"
                />
              </Field>
            )}

            {node === "parameter" && (
              <>
                <Field label="Variable Type">
                  <input
                    value={panelValues.variableType}
                    onChange={(e) =>
                      setPanelValues((p) => ({ ...p, variableType: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="string"
                  />
                </Field>
                <Field label="Pin Type">
                  <input
                    value={panelValues.pinType}
                    onChange={(e) => setPanelValues((p) => ({ ...p, pinType: e.target.value }))}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </Field>
              </>
            )}

            {node === "message" && (
              <Field label="Topic">
                <input
                  value={panelValues.topic}
                  onChange={(e) => setPanelValues((p) => ({ ...p, topic: e.target.value }))}
                  className={inputClass}
                  placeholder="mqtt/device/{{thingName}}/control"
                />
              </Field>
            )}

            {node === "item" && (
              <Field label="Item Code">
                <input
                  value={panelValues.itemCode}
                  onChange={(e) => setPanelValues((p) => ({ ...p, itemCode: e.target.value }))}
                  className={inputClass}
                  placeholder="AUTO_CODE"
                />
              </Field>
            )}

            {panelError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {panelError}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeContextPanel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createNodeRecord()}
              disabled={panelSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {node === "device" ? "Apply" : panelSaving ? "Saving..." : "Create"}
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
            <p className="px-4 py-3 text-[12px] text-slate-500">Loading...</p>
          ) : activeOptions.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-500">No records available.</p>
          ) : (
            <ul>
              {activeOptions.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => selectOption(entry.label)}
                    className="w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                  >
                    <p className="text-[12px] font-medium text-slate-900">{entry.label}</p>
                    {entry.meta && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{entry.meta}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

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
      <button
        type="button"
        onClick={() => handleNodeClick(nodeKey)}
        className={`relative h-28 w-full rounded-2xl px-4 text-left shadow-sm transition lg:h-36 ${
          selected ? theme.selected : theme.idle
        }`}
      >
        <span
          className={`absolute left-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${theme.badge}`}
        >
          {globalIndex + 1}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {nodeConfig.label}
        </span>
        <p className="mt-2 line-clamp-2 text-[12px] font-medium text-slate-900">
          {boundValue || "Not selected"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCreatePanel(nodeKey);
          }}
          className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition ${theme.plus}`}
          aria-label={`Add ${nodeConfig.label}`}
        >
          <Plus size={14} />
        </button>
      </button>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 grid-cols-1">
        <div className="relative min-h-[76vh] overflow-x-auto overflow-y-visible rounded-3xl border border-blue-200/70 bg-gradient-to-br from-sky-50 via-indigo-50 to-cyan-50 p-6 shadow-sm">
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Workflow Builder
            </p>

            <div className="mt-6">
              {/* ── Mobile / tablet: flat 2-col grid, panel stacks below its block ── */}
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

              {/* ── Desktop: one flex-row per logical row; panel inserts right after its block ── */}
              <div className="hidden lg:flex lg:flex-col lg:gap-10">
                {DESKTOP_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex items-start gap-6">
                    {/* Spacer so the device row aligns under column 2 */}
                    {rowIdx === 2 && <div className="flex-1" />}

                    {row.map((nodeKey) => {
                      const globalIndex = WORKFLOW_NODES.findIndex((n) => n.key === nodeKey);
                      const isActive = panelNode === nodeKey && panelMode !== null;

                      return (
                        <Fragment key={nodeKey}>
                          {/* Block — grows to fill available row space */}
                          <div className="flex-1 min-w-0">
                            {renderBlock(nodeKey, globalIndex)}
                          </div>

                          {/* Panel — inserted immediately to the right of its block */}
                          {isActive && (
                            <div className="w-[280px] flex-shrink-0">
                              {renderContextPanel(nodeKey, panelMode!)}
                            </div>
                          )}
                        </Fragment>
                      );
                    })}
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
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : editing ? "Save Device" : "Create Device"}
          </button>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
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
