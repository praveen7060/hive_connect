/* eslint-disable react-refresh/only-export-components */
import { useState, type FormEvent, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { FormFieldConfig, ManagementFormProps } from "../management/types";

export const vendorFormFields: FormFieldConfig[] = [
  {
    key: "name",
    label: "Vendor Name",
    type: "text",
    required: true,
    placeholder: "Enter vendor name",
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: false,
    placeholder: "Enter description",
  },
  {
    key: "type",
    label: "Vendor Type",
    type: "select",
    required: true,
    options: ["Third Party", "Primary"],
  },
  {
    key: "industry",
    label: "Industry",
    type: "select",
    required: true,
    options: [
      "AGRICULTURE", "AUTOMOTIVE", "BANKING_FINANCE", "CONSTRUCTION", 
      "EDUCATION", "ENERGY", "HEALTHCARE", "HOSPITALITY", 
      "INFORMATION_TECHNOLOGY", "MANUFACTURING", "MEDIA_ENTERTAINMENT", 
      "REAL_ESTATE", "RETAIL", "TELECOMMUNICATIONS", "TRANSPORTATION", 
      "IOT", "MARKETING", "CONSULTING", "LOGISTICS", "OTHER"
    ],
  },
  {
    key: "protocol",
    label: "Protocol",
    type: "select",
    required: true,
    options: ["API", "HTTP", "MQTT", "WEBSOCKET", "ZIGBEE"],
  },
];

type AuthType = "OAUTH2" | "Credentials" | "JWT" | "Certificate" | "";
type VendorProtocol = "API" | "HTTP" | "MQTT" | "WEBSOCKET" | "ZIGBEE" | "";

interface VendorFormProps extends ManagementFormProps {
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function VendorForm({
  formId,
  formTitle,
  formSubtitle,
  editing,
  values = {},
  onValueChange,
  onSubmit,
  onCancel,
  onSaveAndNext,
  onBack,
}: VendorFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [authType, setAuthType] = useState<AuthType>((values?.authType as AuthType) ?? "");
  const protocol = ((values?.protocol as VendorProtocol) ?? "");
  const [imageName, setImageName] = useState<string>("");
  const formContentRef = useRef<HTMLDivElement>(null);

  // Update auth type when values change (for editing)
  useEffect(() => {
    if (values?.authType) {
      setAuthType(values.authType as AuthType);
      return;
    }
    setAuthType("");
  }, [values?.authType]);

  useEffect(() => {
    const selectedImage = values?.image;
    if (typeof selectedImage === "string" && selectedImage.trim()) {
      setImageName(selectedImage);
      return;
    }
    setImageName("");
  }, [values?.image]);

  const handleAuthTypeChange = (type: AuthType) => {
    setAuthType(type);
    onValueChange("authType", type);
  };

  const handleSaveAndNext = (e: React.MouseEvent) => {
    e.preventDefault();
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    if (!form.reportValidity()) return;

    if (onSaveAndNext) {
      onSaveAndNext();
      return;
    }

    form.requestSubmit();
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      e.target.value = "";
      return;
    }

    if (!file.type.match(/image\/(png|jpeg|jpg|webp)/)) {
      alert("Only PNG, JPG & WEBP formats are supported");
      e.target.value = "";
      return;
    }

    setImageName(file.name);
    onValueChange("image", file.name);
  };

  const renderAuthFields = () => {
    switch (authType) {
      case "OAUTH2":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Client ID</span>
                <input
                  name={`${formId}-oauth-client-id`}
                  type="text"
                  value={String(values?.clientId ?? "")}
                  onChange={(e) => onValueChange("clientId", e.target.value)}
                  autoComplete="off"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Client Secret</span>
                <input
                  name={`${formId}-oauth-client-secret`}
                  type="password"
                  value={String(values?.clientSecret ?? "")}
                  onChange={(e) => onValueChange("clientSecret", e.target.value)}
                  autoComplete="new-password"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
            
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Authorization URL</span>
              <input
                type="text"
                value={String(values?.authorizationUrl ?? "")}
                onChange={(e) => onValueChange("authorizationUrl", e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Token URL</span>
              <input
                type="text"
                value={String(values?.tokenUrl ?? "")}
                onChange={(e) => onValueChange("tokenUrl", e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
            
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Redirect URI</span>
              <input
                type="text"
                value={String(values?.redirectUri ?? "")}
                onChange={(e) => onValueChange("redirectUri", e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
        );

      case "Credentials":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Token Type</span>
                <select
                  value={String(values?.tokenType ?? "Bearer")}
                  onChange={(e) => onValueChange("tokenType", e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Bearer">Bearer</option>
                  <option value="MAC">MAC</option>
                </select>
              </label>
            </div>
            
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">API Token</span>
              <input
                type="text"
                value={String(values?.apiToken ?? "")}
                onChange={(e) => onValueChange("apiToken", e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
        );

      case "JWT":
        return (
          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">JWT Token</span>
              <textarea
                rows={3}
                value={String(values?.jwtToken ?? "")}
                onChange={(e) => onValueChange("jwtToken", e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter JWT token"
              />
            </label>
          </div>
        );

      case "Certificate":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Certificate</span>
                <textarea
                  rows={4}
                  value={String(values?.certificate ?? "")}
                  onChange={(e) => onValueChange("certificate", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="Enter the Certificate in PEM format"
                />
                <p className="text-xs text-slate-500 mt-1">Enter the Certificate in PEM format</p>
              </label>

              <hr className="border-slate-200" />

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Public Key</span>
                <textarea
                  rows={4}
                  value={String(values?.publicKey ?? "")}
                  onChange={(e) => onValueChange("publicKey", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="Enter the Public Key in PEM format"
                />
                <p className="text-xs text-slate-500 mt-1">Enter the Public Key in PEM format</p>
              </label>

              <hr className="border-slate-200" />

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Private Key</span>
                <textarea
                  rows={4}
                  value={String(values?.privateKey ?? "")}
                  onChange={(e) => onValueChange("privateKey", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="Enter the Private Key in PEM format"
                />
                <p className="text-xs text-slate-500 mt-1">Enter the Private Key in PEM format</p>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderProtocolFields = () => {
    if (protocol === "API" || protocol === "HTTP") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Base URL</span>
            <input
              type="text"
              value={String(values?.baseUrl ?? "")}
              onChange={(e) => onValueChange("baseUrl", e.target.value)}
              placeholder="https://openapi.tuyain.com"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">API Version</span>
            <input
              type="text"
              value={String(values?.apiVersion ?? "")}
              onChange={(e) => onValueChange("apiVersion", e.target.value)}
              placeholder="v1.0"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">UID / Account Key</span>
            <input
              type="text"
              value={String(values?.uid ?? "")}
              onChange={(e) => onValueChange("uid", e.target.value)}
              placeholder="Tuya user UID"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      );
    }

    if (protocol === "MQTT") {
      return (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">MQTT Endpoint</span>
          <input
            type="text"
            value={String(values?.mqttEndpoint ?? "")}
            onChange={(e) => onValueChange("mqttEndpoint", e.target.value)}
            placeholder="mqtt.vendor.com"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      );
    }

    if (protocol === "WEBSOCKET") {
      return (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">WebSocket URL</span>
          <input
            type="text"
            value={String(values?.websocketUrl ?? "")}
            onChange={(e) => onValueChange("websocketUrl", e.target.value)}
            placeholder="wss://stream.vendor.com/devices"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      );
    }

    if (protocol === "ZIGBEE") {
      return (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Zigbee Profile</span>
          <input
            type="text"
            value={String(values?.zigbeeProfile ?? "")}
            onChange={(e) => onValueChange("zigbeeProfile", e.target.value)}
            placeholder="HA 1.2 / Zigbee 3.0"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      );
    }

    return null;
  };

  // Image upload section
  const renderImageUpload = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-900">Image (Optional)</h3>
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
        <input
          id={`${formId}-image-upload`}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="mb-2 text-center">
          <p className="text-sm text-slate-600">Drop Vendor Logo here, or browse</p>
          <p className="mt-1 text-xs text-slate-500">Supports PNG, JPG & WEBP up to 5MB</p>
        </div>
        <label
          htmlFor={`${formId}-image-upload`}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Browse Files
        </label>
        {imageName && <p className="mt-2 text-xs text-emerald-700">Selected: {imageName}</p>}
      </div>
    </div>
  );

  return (
    <div className="inventory-form-theme inventory-form-panel rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
      {/* Fixed Header */}
      <div className="inventory-form-header px-6 py-5 border-b border-slate-200 flex-shrink-0 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {formTitle}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {formSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div 
        ref={formContentRef}
        className="inventory-form-body flex-1 overflow-y-auto px-6 py-5 bg-white"
        style={{ scrollBehavior: 'smooth' }}
      >
        <form id={formId} className="space-y-6" onSubmit={handleFormSubmit} autoComplete="off">
          {/* Basic Fields */}
          <div className="grid gap-5 md:grid-cols-2">
            {vendorFormFields.map((field) => {
              const fieldValue = values?.[field.key];
              const inputId = `${formId}-${field.key}`;

              if (field.type === "select") {
                return (
                  <div key={field.key} className={field.key === "description" ? "md:col-span-2" : ""}>
                    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
                      <span className="text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </span>
                      <select
                        id={inputId}
                        value={String(fieldValue ?? "")}
                        required={field.required}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              }

              if (field.type === "textarea") {
                return (
                  <div key={field.key} className="md:col-span-2">
                    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
                      <span className="text-sm font-medium text-slate-700">
                        {field.label}
                      </span>
                      <textarea
                        id={inputId}
                        rows={3}
                        value={String(fieldValue ?? "")}
                        placeholder={field.placeholder}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                );
              }

              return (
                <div key={field.key}>
                  <label className="flex flex-col gap-1.5" htmlFor={inputId}>
                    <span className="text-sm font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="ml-1 text-red-500">*</span>}
                    </span>
                    <input
                      id={inputId}
                      type="text"
                      value={String(fieldValue ?? "")}
                      required={field.required}
                      placeholder={field.placeholder}
                      onChange={(event) => onValueChange(field.key, event.target.value)}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {/* Image Upload Section */}
          {renderImageUpload()}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-900">Protocol Configuration</h3>
            <div className="space-y-4">
              {renderProtocolFields()}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={String(values?.status ?? "active")}
                  onChange={(e) => onValueChange("status", e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={String(values?.notes ?? "")}
                  onChange={(e) => onValueChange("notes", e.target.value)}
                  placeholder="Use API/HTTP vendors for endpoint-based messaging policies like Tuya."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="flex w-full items-center justify-between p-4 text-left text-slate-900 transition-colors hover:bg-slate-50"
            >
              <span className="font-medium">
                Advanced Options {!showAdvanced && <span className="text-sm font-normal text-slate-500 ml-1">(Optional)</span>}
              </span>
              <span className="text-slate-500">{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="border-t border-slate-200 p-4 bg-slate-50/50">
                {/* Auth Type Selection */}
                <div className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Auth Type</span>
                    <div className="flex flex-wrap gap-2">
                      {(["OAUTH2", "Credentials", "JWT", "Certificate"] as AuthType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleAuthTypeChange(type)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            authType === type
                              ? "bg-blue-600 text-white"
                              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </label>

                  {/* Dynamic Auth Fields */}
                  {renderAuthFields()}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Fixed Footer with Three Buttons */}
      <div className="inventory-form-footer px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack ?? onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Back
          </button>
          <button
            type="submit"
            form={formId}
            className="flex-1 rounded-lg bg-slate-900 py-2.5 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            {editing ? "Save Changes" : "Save"}
          </button>
          {!editing && (
            <button
              type="button"
              onClick={handleSaveAndNext}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              Save & Next
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-6 pb-4 pt-0">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            You are editing an existing record.
          </p>
        </div>
      )}
    </div>
  );
}
