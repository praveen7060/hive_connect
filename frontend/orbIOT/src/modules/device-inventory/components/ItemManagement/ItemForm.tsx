// itemform.tsx
/* eslint-disable react-refresh/only-export-components */
import type { FormFieldConfig, ManagementFormProps } from "../management/types";
import { useState } from "react";
import { Upload, X, ChevronDown, ChevronUp } from "lucide-react";

export const itemFormFields: FormFieldConfig[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Enter item name" },
  { key: "itemCode", label: "Item Code", type: "text", required: true, placeholder: "Enter item code" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Enter description" },
  { key: "metadata", label: "Metadata", type: "textarea", placeholder: "{}" },
  { key: "itemPollingConfig", label: "Item Polling Config", type: "textarea", placeholder: "{}" },
  { key: "vendor", label: "Vendor", type: "select", required: true, options: [] },
  { key: "itemType", label: "Item Type", type: "select", required: true, options: [] },
  { key: "communicationPolicy", label: "Communication Policy", type: "select", required: true, options: [] },
  { key: "gateway", label: "Gateway (optional)", type: "select", options: ["None", "Gateway A", "Gateway B", "Gateway C"] },
];

// Extended props interface to include onSaveAndNext
interface ExtendedManagementFormProps extends ManagementFormProps {
  vendorOptions: string[];
  itemTypeOptions: string[];
  communicationPolicyOptions: string[];
  vendorsLoading?: boolean;
  itemTypesLoading?: boolean;
  communicationPoliciesLoading?: boolean;
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function ItemForm({
  formId,
  editing,
  values,
  vendorOptions,
  itemTypeOptions,
  communicationPolicyOptions,
  vendorsLoading = false,
  itemTypesLoading = false,
  communicationPoliciesLoading = false,
  onValueChange,
  onSubmit,
  onCancel,
  onSaveAndNext,
  onBack,
}: ExtendedManagementFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [componentCount, setComponentCount] = useState<number | "">("");
  const [secureItem, setSecureItem] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Icon options from the image
  const icons = [
    "Charger",
    "Sensor",
    "Light",
    "Fan",
    "Music",
    "Switch",
    "Drone",
    "Car",
    "Energy",
    "Video",
    "Audio",
    "Bike",
    "Truck",
    "Device",
    "Thing",
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSaveAndNext = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form || !form.reportValidity()) return;
    onSaveAndNext?.();
  };

  return (
    <article className="inventory-form-theme mx-auto w-full">
      <form id={formId} className="space-y-6" onSubmit={onSubmit}>
        {/* Form fields grid - exactly matching the images */}
        <div className="bg-white rounded-xl border border-[#eef2f6] shadow-sm p-6 space-y-6">
          {/* Name - Required */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={values.name || ""}
              required
              placeholder="Enter item name"
              onChange={(event) => onValueChange("name", event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20"
            />
          </div>

          {/* Item Code - Required */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Item Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={values.itemCode || ""}
              required
              placeholder="Enter item code"
              onChange={(event) => onValueChange("itemCode", event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Description
            </label>
            <textarea
              value={values.description || ""}
              onChange={(event) => onValueChange("description", event.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 resize-none"
              placeholder="Enter description"
            />
          </div>

          {/* Metadata */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Metadata
            </label>
            <div className="relative">
              <textarea
                value={values.metadata || ""}
                onChange={(event) => onValueChange("metadata", event.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 font-mono"
                placeholder="{}"
              />
              <span className="absolute right-3 top-2 text-xs text-[#8a9bb5]">JSON</span>
            </div>
          </div>

          {/* Item Polling Config */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Item Polling Config
            </label>
            <div className="relative">
              <textarea
                value={values.itemPollingConfig || ""}
                onChange={(event) => onValueChange("itemPollingConfig", event.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 font-mono"
                placeholder="{}"
              />
              <span className="absolute right-3 top-2 text-xs text-[#8a9bb5]">JSON</span>
            </div>
          </div>

          {/* Divider for visual separation */}
          <div className="border-t border-[#eef2f6] pt-4">
            <h3 className="text-sm font-semibold text-[#0f2554] mb-4">Item Configuration</h3>
          </div>

          {/* Image Upload - exactly as in image */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Image
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                dragActive 
                  ? "border-[#3d95f5] bg-[#3d95f5]/5" 
                  : "border-[#d7dde6] hover:border-[#8a9bb5]"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="item-image"
              />
              <label htmlFor="item-image" className="cursor-pointer block">
                <div className="flex justify-center mb-2">
                  <Upload size={24} className="text-[#8a9bb5]" />
                </div>
                <p className="text-sm text-[#5f6f8a]">
                  Drop Item Image Here, or{' '}
                  <span className="text-[#3d95f5] font-medium hover:underline">
                    browse
                  </span>
                </p>
                <p className="text-xs text-[#8a9bb5] mt-1">
                  Supports PNG, JPG & WEBP up to 10MB
                </p>
              </label>
              {selectedFile && (
                <div className="mt-3 flex items-center justify-between bg-[#f5f7fa] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#25334d] truncate max-w-[200px]">
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-[#8a9bb5] hover:text-[#ff4d4f]"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Icon - Required with dropdown */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Icon <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconDropdown(!showIconDropdown)}
                className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-left text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 flex justify-between items-center"
              >
                <span className={values.icon ? "text-[#25334d]" : "text-[#8a9bb5]"}>
                  {values.icon || "Select an Icon"}
                </span>
                <ChevronDown size={16} className="text-[#8a9bb5]" />
              </button>
              
              {showIconDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowIconDropdown(false)}
                  />
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#eef2f6] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {icons.map((icon) => (
                      <div
                        key={icon}
                        onClick={() => {
                          onValueChange("icon", icon);
                          setShowIconDropdown(false);
                        }}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          values.icon === icon
                            ? "bg-[#eef2f6] text-[#0f2554]"
                            : "text-[#25334d] hover:bg-[#f5f7fa]"
                        }`}
                      >
                        {icon}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add Tags"
                className="flex-1 h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-[#3d95f5] text-white rounded-lg text-sm font-medium hover:bg-[#2e84e2] transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 bg-[#eef2f6] rounded-full px-3 py-1.5 text-xs font-medium text-[#25334d]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-[#8a9bb5] hover:text-[#ff4d4f]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Component Count */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Component Count
            </label>
            <input
              type="number"
              value={componentCount}
              onChange={(e) =>
                setComponentCount(e.target.value === "" ? "" : Number(e.target.value))
              }
              min={0}
              className="w-32 h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20"
            />
          </div>

          {/* Secure Item Toggle - exactly as in image */}
          <div className="flex items-start gap-3 py-2">
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input
                type="checkbox"
                id="secure-item"
                checked={secureItem}
                onChange={(e) => {
                  setSecureItem(e.target.checked);
                  onValueChange("secureItem", e.target.checked);
                }}
                className="sr-only"
              />
              <label
                htmlFor="secure-item"
                className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${
                  secureItem ? "bg-[#3d95f5]" : "bg-[#d7dde6]"
                }`}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                    secureItem ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </label>
            </div>
            <div className="flex-1">
              <label htmlFor="secure-item" className="text-sm font-medium text-[#334664] cursor-pointer">
                Secure Item
              </label>
              <p className="text-xs text-[#5f6f8a] mt-0.5">
                Enable if this item requires Secure Communication
              </p>
            </div>
          </div>

          {/* Vendor - Required */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={values.vendor || ""}
              required
              onChange={(event) => onValueChange("vendor", event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238a9bb5%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pr-8"
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
          </div>

          {/* Item Type - Required */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Item Type <span className="text-red-500">*</span>
            </label>
            <select
              value={values.itemType || ""}
              required
              onChange={(event) => onValueChange("itemType", event.target.value)}
              disabled={!values.vendor || itemTypesLoading}
              className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238a9bb5%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="">
                {itemTypesLoading
                  ? "Loading item types..."
                  : !values.vendor
                    ? "Select vendor first"
                    : itemTypeOptions.length > 0
                      ? "Select item type"
                      : "No item types for selected vendor"}
              </option>
              {itemTypeOptions.map((itemType) => (
                <option key={itemType} value={itemType}>{itemType}</option>
              ))}
            </select>
          </div>

          {/* Communication Policy - Required */}
          <div>
            <label className="block text-sm font-medium text-[#334664] mb-1.5">
              Communication Policy <span className="text-red-500">*</span>
            </label>
            <select
              value={values.communicationPolicy || ""}
              required
              onChange={(event) => onValueChange("communicationPolicy", event.target.value)}
              disabled={communicationPoliciesLoading}
              className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238a9bb5%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="">
                {communicationPoliciesLoading
                  ? "Loading communication policies..."
                  : communicationPolicyOptions.length > 0
                    ? "Select communication policy"
                    : "No communication policies available"}
              </option>
              {communicationPolicyOptions.map((policy) => (
                <option key={policy} value={policy}>{policy}</option>
              ))}
            </select>
          </div>

          {/* Advanced Options Dropdown - exactly as in image */}
          <div className="border border-[#eef2f6] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex justify-between items-center p-4 text-left text-sm font-medium text-[#0f2554] hover:bg-[#f5f7fa] transition-colors"
            >
              <span>Advanced Options</span>
              <span className="text-[#8a9bb5]">
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {showAdvanced && (
              <div className="p-4 border-t border-[#eef2f6] bg-[#fafcff]">
                {/* Gateway (optional) */}
                <div>
                  <label className="block text-sm font-medium text-[#334664] mb-1.5">
                    Gateway (optional)
                  </label>
                  <select
                    value={values.gateway || ""}
                    onChange={(event) => onValueChange("gateway", event.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#d7dde6] bg-white text-sm text-[#25334d] outline-none transition-all focus:border-[#3d95f5] focus:ring-2 focus:ring-[#3d95f5]/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238a9bb5%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pr-8"
                  >
                    <option value="">None</option>
                    <option value="gateway_a">Gateway A</option>
                    <option value="gateway_b">Gateway B</option>
                    <option value="gateway_c">Gateway C</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - exactly as in image */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onBack ?? onCancel}
            className="px-6 py-2.5 rounded-lg border border-[#d7dde6] bg-white text-sm font-medium text-[#324260] hover:bg-[#f5f7fa] transition-colors"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-[#3d95f5] text-sm font-medium text-white hover:bg-[#2e84e2] transition-colors shadow-sm"
            >
              Save
            </button>
            {!editing && onSaveAndNext && (
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-6 py-2.5 rounded-lg bg-[#0f2554] text-sm font-medium text-white hover:bg-[#1a3266] transition-colors shadow-sm"
              >
                Save & Next
              </button>
            )}
          </div>
        </div>
      </form>

      {editing && (
        <p className="mt-4 rounded-lg border border-[#e5d3a9] bg-[#f8f1de] px-3 py-2 text-xs text-[#826835]">
          You are editing an existing record.
        </p>
      )}
    </article>
  );
}
