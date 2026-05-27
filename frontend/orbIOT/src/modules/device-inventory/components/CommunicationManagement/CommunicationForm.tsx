/* eslint-disable react-refresh/only-export-components */
import type { FormFieldConfig, ManagementFormProps } from "../management/types";
import { useState, useEffect, useRef } from "react";
import {
  BatteryCharging,
  Bike,
  Box,
  Car,
  ChevronDown,
  ChevronUp,
  Cpu,
  Fan,
  Lightbulb,
  Mic,
  Music,
  Plane,
  Radio,
  ToggleLeft,
  Truck,
  Video,
  Zap,
} from "lucide-react";

export const communicationFormFields: FormFieldConfig[] = [
  { key: "name", label: "Communication Policy Name", type: "text", required: true, placeholder: "Enter policy name" },
  { key: "groupName", label: "Group Name", type: "text", required: true, placeholder: "Enter group name" },
  { key: "itemType", label: "Item Type", type: "select", required: true, options: [] },
  { key: "protocol", label: "Protocol", type: "select", required: true, options: ["API", "HTTP", "MQTT", "WEBSOCKET", "ZIGBEE", "CoAP"] },
  { key: "version", label: "Version", type: "text", placeholder: "0.01" },
  { key: "messageFormat", label: "Message Format", type: "select", options: ["JSON", "XML", "PROTOBUF"] },
  { key: "centric", label: "Centric", type: "select", options: ["TOPIC", "PAYLOAD"] },
  { key: "payloadTopics", label: "Payload Centric Topics", type: "text", placeholder: "Enter Topic" },
  { key: "messageStructure", label: "Message Structure", type: "text", placeholder: "{}" },
  { key: "confirmationMessageStructure", label: "Confirmation Message Structure", type: "text", placeholder: "{}" },
  { key: "icon", label: "Icon", type: "text" },
  { key: "image", label: "Image", type: "file" },
  { key: "needFirmware", label: "Need us to provide firmware?", type: "checkbox" },
  { key: "needConfirmation", label: "Need confirmation message structure if you want Toggle on/off?", type: "checkbox" },
];

interface ExtendedManagementFormProps extends ManagementFormProps {
  itemTypeOptions: string[];
  itemTypesLoading?: boolean;
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function CommunicationForm({
  formId,
  formTitle,
  formSubtitle,
  editing,
  values,
  itemTypeOptions,
  itemTypesLoading = false,
  onValueChange,
  onSubmit,
  onCancel,
  onSaveAndNext,
  onBack,
}: ExtendedManagementFormProps) {
  const [showProtocol, setShowProtocol] = useState(false);
  const [showMessageFormat, setShowMessageFormat] = useState(false);
  const [showCentric, setShowCentric] = useState(false);
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const [imageName, setImageName] = useState("");
  const [payloadTopics, setPayloadTopics] = useState<string[]>([""]);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconDropdownRef = useRef<HTMLDivElement>(null);
  const hasCentricSelection = Boolean(String(values.centric || "").trim());
  const showMessageDetails = showCentric && hasCentricSelection;
  const showConfirmationStructure = showMessageDetails && Boolean(values.needConfirmation);
  const isPayloadCentric = String(values.centric || "").trim().toUpperCase() === "PAYLOAD";

  const iconOptions = [
    { label: "Charger", icon: BatteryCharging },
    { label: "Sensor", icon: Radio },
    { label: "Light", icon: Lightbulb },
    { label: "Fan", icon: Fan },
    { label: "Music", icon: Music },
    { label: "Switch", icon: ToggleLeft },
    { label: "Drone", icon: Plane },
    { label: "Car", icon: Car },
    { label: "Energy", icon: Zap },
    { label: "Video", icon: Video },
    { label: "Audio", icon: Mic },
    { label: "Bike", icon: Bike },
    { label: "Truck", icon: Truck },
    { label: "Device", icon: Cpu },
    { label: "Thing", icon: Box },
  ] as const;

  // Update visibility based on values
  useEffect(() => {
    if (values.itemType) {
      setShowProtocol(true);
    }
    if (values.protocol) {
      setShowMessageFormat(true);
    }
    if (values.messageFormat) {
      setShowCentric(true);
    }
  }, [values.itemType, values.protocol, values.messageFormat]);

  useEffect(() => {
    const rawValue = String(values.payloadTopics || "").trim();
    if (!rawValue) {
      setPayloadTopics([""]);
      return;
    }

    const parsed = rawValue
      .split("\n")
      .map((topic) => topic.trim())
      .filter(Boolean);

    setPayloadTopics(parsed.length > 0 ? parsed : [""]);
  }, [values.payloadTopics]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!iconDropdownRef.current) return;
      if (!iconDropdownRef.current.contains(event.target as Node)) {
        setShowIconDropdown(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const handleItemTypeChange = (value: string) => {
    onValueChange("itemType", value);
    setShowProtocol(true);
    setShowMessageFormat(false);
    setShowCentric(false);
    // Reset dependent fields
    onValueChange("protocol", "");
    onValueChange("messageFormat", "");
    onValueChange("centric", "");
    onValueChange("messageStructure", "");
    onValueChange("confirmationMessageStructure", "");
    onValueChange("needConfirmation", false);
    onValueChange("payloadTopics", "");
    setPayloadTopics([""]);
    
    // Scroll to top of form content when new section appears
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const handleProtocolChange = (value: string) => {
    onValueChange("protocol", value);
    setShowMessageFormat(true);
    setShowCentric(false);
    // Reset dependent fields
    onValueChange("messageFormat", "");
    onValueChange("centric", "");
    onValueChange("messageStructure", "");
    onValueChange("confirmationMessageStructure", "");
    onValueChange("needConfirmation", false);
    onValueChange("payloadTopics", "");
    setPayloadTopics([""]);
    
    // Scroll to top of form content when new section appears
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const handleMessageFormatChange = (value: string) => {
    onValueChange("messageFormat", value);
    setShowCentric(true);
    // Reset dependent fields
    onValueChange("centric", "");
    onValueChange("messageStructure", "");
    onValueChange("confirmationMessageStructure", "");
    onValueChange("needConfirmation", false);
    onValueChange("payloadTopics", "");
    setPayloadTopics([""]);
    
    // Scroll to top of form content when new section appears
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const handleCentricChange = (value: string) => {
    onValueChange("centric", value);
    if (!value) {
      onValueChange("messageStructure", "");
      onValueChange("confirmationMessageStructure", "");
      onValueChange("needConfirmation", false);
      onValueChange("payloadTopics", "");
      setPayloadTopics([""]);
    }
    
    // Scroll to top of form content when new section appears
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const persistPayloadTopics = (topics: string[]) => {
    const compactTopics = topics.map((topic) => topic.trim()).filter(Boolean);
    onValueChange("payloadTopics", compactTopics.join("\n"));
  };

  const handlePayloadTopicChange = (index: number, value: string) => {
    setPayloadTopics((current) => {
      const next = [...current];
      next[index] = value;
      persistPayloadTopics(next);
      return next;
    });
  };

  const handleAddPayloadTopic = () => {
    setPayloadTopics((current) => {
      const next = [...current, ""];
      persistPayloadTopics(next);
      return next;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert("File size must be less than 3MB");
        return;
      }
      if (!file.type.match(/image\/(png|jpeg|jpg|webp)/)) {
        alert("Only PNG, JPG & WEBP formats are supported");
        return;
      }
      setImageName(file.name);
      // Persist a serializable value for API payloads.
      onValueChange("image", file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleSaveAndNext = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form || !form.reportValidity()) return;

    if (onSaveAndNext) {
      onSaveAndNext();
      return;
    }

    form.requestSubmit();
  };

  return (
    <div className="inventory-form-theme w-full">
      <style>{`
        .form-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .form-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .form-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }
        .form-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>

      {/* Card Container */}
      <div className="inventory-form-panel rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {/* Card Header - Fixed */}
        <div className="inventory-form-header px-7 pt-7 pb-4 border-b border-slate-100">
          <h2 className="text-[19px] font-bold text-slate-900 tracking-[-0.02em]">
            {formTitle || "Create Communication Policy"}
          </h2>
          <p className="text-[12px] text-slate-500 mt-1">
            {formSubtitle || "Enter details in sequence before moving to the next step."}
          </p>
        </div>

        {/* Scrollable Form Content */}
        <div 
          ref={contentRef}
          className="inventory-form-body form-scrollbar max-h-[calc(100vh-400px)] overflow-y-auto px-7 py-6"
          style={{ scrollBehavior: 'smooth' }}
        >
          <form id={formId} onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Communication Policy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.name || ""}
                onChange={(e) => onValueChange("name", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Enter communication policy name"
                required
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Image
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 text-center">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  id="policy-image"
                  onChange={handleImageUpload}
                />
                <label htmlFor="policy-image" className="cursor-pointer block">
                  <p className="text-[13px] text-slate-600">
                    Drop Policy Image Here, or <span className="text-blue-600 font-medium underline">browse</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports PNG, JPG & WEBP up to 3MB
                  </p>
                </label>
                {imageName && (
                  <p className="text-[12px] text-green-600 mt-2">
                    ✓ {imageName}
                  </p>
                )}
              </div>
            </div>

            {/* Icon Selection */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Icon <span className="text-red-500">*</span>
              </label>
              <div ref={iconDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconDropdown((current) => !current)}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-left text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  aria-expanded={showIconDropdown}
                  aria-label="Select an icon"
                >
                  <span>{String(values.icon || "Select an Icon")}</span>
                  {showIconDropdown ? (
                    <ChevronUp size={15} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={15} className="text-slate-400" />
                  )}
                </button>

                {showIconDropdown && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-sm">
                    {iconOptions.map((option) => {
                      const IconComponent = option.icon;
                      const isActive = values.icon === option.label;

                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            onValueChange("icon", option.label);
                            setShowIconDropdown(false);
                          }}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors ${
                            isActive
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <IconComponent size={14} className="text-slate-600" />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Group Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.groupName || ""}
                onChange={(e) => onValueChange("groupName", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="Enter group name"
                required
              />
            </div>

            {/* Need us to provide firmware? */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.needFirmware || false}
                  onChange={(e) => onValueChange("needFirmware", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                />
                <span className="text-[13px] text-slate-700">Need us to provide firmware?</span>
              </label>
            </div>

            {/* Item Type */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                Item Type <span className="text-red-500">*</span>
              </label>
              <select
                value={values.itemType || ""}
                onChange={(e) => handleItemTypeChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                required
              >
                <option value="">
                  {itemTypesLoading
                    ? "Loading item types..."
                    : itemTypeOptions.length > 0
                      ? "Select item type"
                      : "No item types available"}
                </option>
                {itemTypeOptions.map((itemType) => (
                  <option key={itemType} value={itemType}>{itemType}</option>
                ))}
              </select>
            </div>

            {/* Protocol - shown after item type */}
            {showProtocol && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                  Protocol <span className="text-red-500">*</span>
                </label>
                <select
                  value={values.protocol || ""}
                  onChange={(e) => handleProtocolChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  required
                >
                  <option value="">Select Protocol</option>
                  <option value="API">API</option>
                  <option value="HTTP">HTTP</option>
                  <option value="MQTT">MQTT</option>
                  <option value="WEBSOCKET">WEBSOCKET</option>
                  <option value="ZIGBEE">ZIGBEE</option>
                </select>
              </div>
            )}

            {/* Message Format - shown after protocol */}
            {showMessageFormat && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    Version
                  </label>
                  <input
                    type="text"
                    value={values.version || ""}
                    onChange={(e) => onValueChange("version", e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    placeholder="0.01"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    Message Format <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={values.messageFormat || ""}
                    onChange={(e) => handleMessageFormatChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    required
                  >
                    <option value="">Select Message Format</option>
                    <option value="JSON">JSON</option>
                    <option value="ARRAY">ARRAY</option>
                  </select>
                </div>
              </div>
            )}

            {/* Centric - shown after message format */}
            {showCentric && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    Centric <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={values.centric || ""}
                    onChange={(e) => handleCentricChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    required
                  >
                    <option value="">Select Centric</option>
                    <option value="TOPIC">TOPIC</option>
                    <option value="PAYLOAD">PAYLOAD</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                    Communication Method
                  </label>
                  <select
                    value={values.communicationMethod || ""}
                    onChange={(e) => onValueChange("communicationMethod", e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="">Select method</option>
                    <option value="MQTT">MQTT</option>
                    <option value="HTTP">HTTP</option>
                    <option value="PUBLISH">PUBLISH</option>
                    <option value="SUBSCRIBE">SUBSCRIBE</option>
                  </select>
                </div>
              </div>
            )}

            {/* Message detail fields - shown after any centric selection */}
            {showMessageDetails && (
              <>
                {isPayloadCentric ? (
                  <>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          Payload Centric Topics <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddPayloadTopic}
                          className="text-[12px] font-semibold text-slate-600 hover:text-slate-900"
                        >
                          + Add Topic
                        </button>
                      </div>
                      <div className="space-y-2">
                        {payloadTopics.map((topicValue, topicIndex) => (
                          <input
                            key={`payload-topic-${topicIndex}`}
                            type="text"
                            value={topicValue}
                            required={topicIndex === 0}
                            onChange={(e) => handlePayloadTopicChange(topicIndex, e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                            placeholder="Enter Topic"
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Payload Centric Message Structure
                      </label>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex">
                          <div className="w-9 shrink-0 bg-slate-50 pt-3 text-center text-[12px] font-semibold text-slate-400">
                            1
                          </div>
                          <textarea
                            value={String(values.messageStructure || "")}
                            onChange={(e) => onValueChange("messageStructure", e.target.value)}
                            rows={7}
                            className="w-full resize-y border-0 px-3 py-3 text-[13px] font-mono text-slate-800 outline-none focus:ring-0"
                            placeholder='{"deviceid":"","status":""}'
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-[12px] text-slate-500">
                        Confirmation message structures will be optional
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(values.needConfirmation)}
                        onClick={() => {
                          const nextState = !Boolean(values.needConfirmation);
                          onValueChange("needConfirmation", nextState);
                          if (!nextState) {
                            onValueChange("confirmationMessageStructure", "");
                          }
                        }}
                        className={`relative h-6 w-11 rounded-full transition ${
                          values.needConfirmation ? "bg-slate-900" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                            values.needConfirmation ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                        Message Structure
                      </label>
                      <input
                        type="text"
                        value={values.messageStructure || ""}
                        onChange={(e) => onValueChange("messageStructure", e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-mono text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        placeholder="{}"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={values.needConfirmation || false}
                          onChange={(e) => {
                            onValueChange("needConfirmation", e.target.checked);
                            if (!e.target.checked) {
                              onValueChange("confirmationMessageStructure", "");
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                        />
                        <span className="text-[13px] text-slate-700">
                          Need confirmation message structure if you want Toggle on/off?
                        </span>
                      </label>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Confirmation Message Structure */}
            {showConfirmationStructure && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
                  Confirmation Message Structure
                </label>
                <input
                  type="text"
                  value={values.confirmationMessageStructure || ""}
                  onChange={(e) => onValueChange("confirmationMessageStructure", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-mono text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  placeholder='{"status":"ok"}'
                />
              </div>
            )}
          </form>
        </div>

        {/* Form Actions - Fixed */}
        <div className="inventory-form-footer border-t border-slate-100 bg-slate-50/50 px-7 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack ?? onCancel}
              className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                form={formId}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Save
              </button>
              {!editing && (
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  className="rounded-lg bg-slate-900 px-6 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Save & Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <p className="mt-4 rounded-lg border border-[#e5d3a9] bg-[#f8f1de] px-3 py-2 text-xs text-[#826835]">
          You are editing an existing record.
        </p>
      )}
    </div>
  );
}
