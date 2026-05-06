/* eslint-disable react-refresh/only-export-components */
import type { FormFieldConfig, ManagementFormProps } from "../management/types";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

const MESSAGE_TYPE_OPTIONS = [
  "ON_OFF",
  "SET_ADJUST",
  "GETDATA",
  "TOGGLE",
  "CONTROL",
  "SENSING",
  "SECURITY",
  "CONNECTION",
  "START_STOP",
  "LOCK_UNLOCK",
  "ARM_DISARM",
  "EMERGENCY",
  "PLAYBACK",
  "QUERY",
  "CALIBRATION",
  "DIAGNOSTIC",
  "UPDATE",
  "STATUS",
  "WRITE",
  "NOTIFICATION",
  "CONFIGURATION",
  "AUTHENTICATE",
  "GROUPING",
  "SCENE",
  "GEOFENCING",
  "SESSION",
  "FIRMWARE",
] as const;

export const messagingFormFields: FormFieldConfig[] = [
  { key: "itemType", label: "Item Type", type: "select", required: true, options: [] },
  { key: "communicationPolicy", label: "Communication Policy", type: "select", required: true, options: [] },
  { key: "topic", label: "Topic", type: "text", required: true, placeholder: "e.g. mqtt/device/@{deviceId}/update" },
  { key: "messageType", label: "Message Type", type: "select", options: [...MESSAGE_TYPE_OPTIONS] },
  { key: "commandType", label: "Command Type", type: "select", options: ["PUBLISH", "SUBSCRIBE", "GET", "POST"] },
  { key: "policyType", label: "Policy Type", type: "select", options: ["EXECUTE", "QUERY", "REGISTER", "BOOT", "SYNC", "OTA"] },
];

interface MessagingFormProps extends ManagementFormProps {
  itemTypeOptions: string[];
  communicationPolicyOptions: string[];
  itemTypesLoading?: boolean;
  communicationPoliciesLoading?: boolean;
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function MessagingForm({
  formId,
  formTitle,
  formSubtitle,
  values,
  itemTypeOptions,
  communicationPolicyOptions,
  itemTypesLoading = false,
  communicationPoliciesLoading = false,
  onValueChange,
  onSubmit,
  onCancel,
  editing,
  onSaveAndNext,
  onBack,
}: MessagingFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Show remaining fields only after both required fields are selected
  const [showRemainingFields, setShowRemainingFields] = useState(false);
  
  useEffect(() => {
    // Check if both itemType and communicationPolicy have values
    if (values.itemType && values.communicationPolicy) {
      setShowRemainingFields(true);
    } else {
      setShowRemainingFields(false);
    }
  }, [values.itemType, values.communicationPolicy]);

  const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
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
    <form id={formId} onSubmit={handleSubmitForm} className="inventory-form-theme space-y-5">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0f2554]">
            {formTitle}
          </h2>
          <p className="mt-1 text-sm text-[#5f6f8a]">{formSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Item Type - Always visible */}
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
            Item Type <span className="text-rose-500">*</span>
          </span>
          <select
            value={values.itemType || ""}
            required
            onChange={(e) => onValueChange("itemType", e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer appearance-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1rem" }}
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
        </label>
      </div>

      {/* Communication Policy - Always visible */}
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
            Communication Policy <span className="text-rose-500">*</span>
          </span>
          <select
            value={values.communicationPolicy || ""}
            required
            onChange={(e) => onValueChange("communicationPolicy", e.target.value)}
            disabled={!values.itemType || communicationPoliciesLoading}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer appearance-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1rem" }}
          >
            <option value="">
              {!values.itemType
                ? "Select item type first"
                : communicationPoliciesLoading
                  ? "Loading communication policies..."
                  : communicationPolicyOptions.length > 0
                    ? "Select communication policy"
                    : "No communication policies for selected item type"}
            </option>
            {communicationPolicyOptions.map((policy) => (
              <option key={policy} value={policy}>{policy}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Remaining fields - Only shown after both required fields are selected */}
      {showRemainingFields && (
        <>
          {/* Topic */}
          <div className="space-y-2 pt-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Topic <span className="text-rose-500">*</span>
              </span>
              <input
                type="text"
                value={values.topic || ""}
                required
                onChange={(e) => onValueChange("topic", e.target.value)}
                placeholder="e.g. mqtt/device/@{deviceId}/update"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </label>
          </div>

          {/* Is Topic Unique */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(values.topicUnique)}
                onChange={(e) => onValueChange("topicUnique", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
              />
              <span className="text-[13px] font-medium text-slate-700">Is Topic Unique</span>
            </label>
          </div>

          <div className="space-y-2 ml-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(values.isPayloadCentric)}
                onChange={(e) => onValueChange("isPayloadCentric", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200 mt-0.5"
              />
              <div>
                <span className="text-[13px] font-medium text-slate-700">Is Payload Centric Topic</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Mark when payload shape is the primary routing contract.</p>
              </div>
            </label>
          </div>

          {/* Message Type */}
          <div className="space-y-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Message Type
              </span>
              <select
                value={values.messageType || ""}
                required
                onChange={(e) => onValueChange("messageType", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1rem" }}
              >
                <option value="">Select message type</option>
                {MESSAGE_TYPE_OPTIONS.map((messageType) => (
                  <option key={messageType} value={messageType}>
                    {messageType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Logged Message Toggle */}
          <div className="space-y-2 ml-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(values.loggedMessage)}
                onChange={(e) => onValueChange("loggedMessage", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200 mt-0.5"
              />
              <div>
                <span className="text-[13px] font-medium text-slate-700">Logged Message</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Enable to log all messages for this policy.</p>
              </div>
            </label>
          </div>

          {/* Retain Message Toggle */}
          <div className="space-y-2 ml-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(values.retainMessages)}
                onChange={(e) => onValueChange("retainMessages", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200 mt-0.5"
              />
              <div>
                <span className="text-[13px] font-medium text-slate-700">Retain Message</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Enable to retain the message for this policy.</p>
              </div>
            </label>
          </div>

          {/* Command Type */}
          <div className="space-y-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Command Type
              </span>
              <select
                value={values.commandType || ""}
                onChange={(e) => onValueChange("commandType", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1rem" }}
              >
                <option value="">Select command type</option>
                <option value="PUBLISH">PUBLISH</option>
                <option value="SUBSCRIBE">SUBSCRIBE</option>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </label>
          </div>

          {/* Policy Type */}
          <div className="space-y-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Policy Type
              </span>
              <select
                value={values.policyType || ""}
                required
                onChange={(e) => onValueChange("policyType", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1rem" }}
              >
                <option value="">Select policy type</option>
                <option value="EXECUTE">EXECUTE</option>
                <option value="QUERY">QUERY</option>
                <option value="REGISTER">REGISTER</option>
                <option value="BOOT">BOOT</option>
                <option value="SYNC">SYNC</option>
                <option value="OTA">OTA</option>
              </select>
            </label>
          </div>

          {/* Request Payload Format */}
          <div className="space-y-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Request Payload Format
              </span>
              <textarea
                value={String(values.requestPayloadFormat || values.payloadFormat || "")}
                onChange={(e) => {
                  onValueChange("requestPayloadFormat", e.target.value);
                  onValueChange("payloadFormat", e.target.value);
                }}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-mono text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder={'{\n  "deviceid": "@{device.foreignId}",\n  "status": "${status}"\n}'}
              />
            </label>
          </div>

          <div className="space-y-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Response Payload Format
              </span>
              <textarea
                value={String(values.responsePayloadFormat || values.confirmationPayloadFormat || "")}
                onChange={(e) => {
                  onValueChange("responsePayloadFormat", e.target.value);
                  onValueChange("confirmationPayloadFormat", e.target.value);
                }}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-mono text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder={'{\n  "reply": "${reply}"\n}'}
              />
            </label>
          </div>

         

          {/* Advanced Options */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex justify-between items-center p-4 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>Advanced Options</span>
              <span className="text-slate-400 text-lg">{showAdvanced ? '−' : '+'}</span>
            </button>

            {showAdvanced && (
              <div className="p-4 border-t border-slate-100 space-y-4">
                {/* QOS */}
                <div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">QOS</span>
                    <input
                      type="number"
                      value={
                        values.qos === undefined || values.qos === null || values.qos === ""
                          ? ""
                          : Number(values.qos)
                      }
                      onChange={(e) =>
                        onValueChange(
                          "qos",
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      min={0}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>

                {/* Polling Interval */}
                <div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Polling Interval (seconds)</span>
                    <input
                      type="number"
                      value={
                        values.pollingInterval === undefined ||
                        values.pollingInterval === null ||
                        values.pollingInterval === ""
                          ? ""
                          : Number(values.pollingInterval)
                      }
                      onChange={(e) =>
                        onValueChange(
                          "pollingInterval",
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      min={0}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-6">
        <button
          type="button"
          onClick={onBack ?? onCancel}
          className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-[13px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-[13px] font-bold text-white shadow-md transition-all hover:bg-slate-700 hover:shadow-lg active:scale-[0.98]"
          >
            Save
          </button>
          {!editing && (
            <button
              type="button"
              onClick={handleSaveAndNext}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-[13px] font-bold text-white shadow-md transition-all hover:bg-slate-700 hover:shadow-lg active:scale-[0.98]"
            >
              Save & Next
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
