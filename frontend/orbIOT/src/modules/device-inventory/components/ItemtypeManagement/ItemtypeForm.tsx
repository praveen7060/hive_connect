/* eslint-disable react-refresh/only-export-components */
import type { FormFieldConfig, ManagementFormProps } from "../management/types";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export const itemTypeFormFields: FormFieldConfig[] = [
  { key: "name", label: "Item Type Name", type: "text", required: true, placeholder: "e.g. smart_switch" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Enter description" },
  { key: "synonyms", label: "Synonyms", type: "text", placeholder: "e.g. alias1, alias2" },
];

interface ItemTypeFormProps extends ManagementFormProps {
  vendorOptions: string[];
  vendorsLoading?: boolean;
  parameterOptions: Array<{ name: string; variableType: string }>;
  parametersLoading?: boolean;
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function ItemtypeForm({
  formId,
  formTitle,
  formSubtitle,
  editing,
  values,
  vendorOptions,
  vendorsLoading = false,
  parameterOptions,
  parametersLoading = false,
  onValueChange,
  onSubmit,
  onCancel,
  onSaveAndNext,
  onBack,
}: ItemTypeFormProps) {
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageName(file.name);
    }
  };

  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vendor = e.target.value;
    setSelectedVendor(vendor);
    onValueChange("vendorName", vendor);
    onValueChange("parameterName", "");
  };

  const handleRemoveVendor = () => {
    setSelectedVendor("");
    onValueChange("vendorName", "");
    onValueChange("parameterName", "");
  };

  useEffect(() => {
    const vendor = String(values.vendorName || "");
    setSelectedVendor(vendor);
  }, [values.vendorName]);

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
    <div className="inventory-form-theme inventory-form-panel bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full max-h-[calc(100vh-200px)]">
      {/* Header with X button */}
      <div className="inventory-form-header px-6 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{formTitle}</h2>
          <p className="text-sm text-gray-500 mt-1">{formSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="inventory-form-body flex-1 overflow-y-auto">
        <form id={formId} onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-5">
            {/* Item Type Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Item Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.name || ""}
                required
                placeholder="e.g. smart_switch"
                onChange={(e) => onValueChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={values.description || ""}
                onChange={(e) => onValueChange("description", e.target.value)}
                rows={3}
                placeholder="Enter description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Image
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {imageName ? (
                  <p className="text-sm text-gray-600">{imageName}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Drop Item Type Image Here, or{" "}
                      <span className="text-blue-600 hover:text-blue-700 font-medium">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Supports PNG, JPG & WEBP up to 5MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Synonyms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Synonyms
              </label>
              <input
                type="text"
                value={values.synonyms || ""}
                onChange={(e) => onValueChange("synonyms", e.target.value)}
                placeholder="e.g. alias1, alias2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Comma-separated list of synonyms, e.g. alias1, alias2
              </p>
            </div>

            {/* Vendors */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Vendors <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVendor}
                onChange={handleVendorChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">
                  {vendorsLoading
                    ? "Loading vendors..."
                    : vendorOptions.length > 0
                      ? "Select vendor"
                      : "No vendors available"}
                </option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>

              {/* Vendor chip (shown when vendor selected) */}
              {selectedVendor && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
                  <span className="text-sm text-gray-700">{selectedVendor}</span>
                  <button
                    type="button"
                    onClick={handleRemoveVendor}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Parameter dropdown (filtered by selected vendor) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Parameter
              </label>
              <select
                value={String(values.parameterName || "")}
                onChange={(e) => onValueChange("parameterName", e.target.value)}
                disabled={!selectedVendor || parametersLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!selectedVendor
                    ? "Select vendor first"
                    : parametersLoading
                      ? "Loading parameters..."
                      : parameterOptions.length > 0
                        ? "Select parameter"
                        : "No parameters for selected vendor"}
                </option>
                {parameterOptions.map((parameter) => (
                  <option key={parameter.name} value={parameter.name}>
                    {parameter.variableType
                      ? `${parameter.name} (${parameter.variableType})`
                      : parameter.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer with buttons - Fixed at bottom */}
          <div className="inventory-form-footer px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between sticky bottom-0">
            <button
              type="button"
              onClick={onBack ?? onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
              {!editing && (
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save & Next
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {editing && (
        <div className="px-6 pb-5">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You are editing an existing record.
          </p>
        </div>
      )}
    </div>
  );
}
