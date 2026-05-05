import { useEffect, useState } from "react";

interface DeviceFormProps {
  formId: string;
  formTitle: string;
  formSubtitle: string;
  editing: boolean;
  values: Record<string, any>;
  vendorOptions: string[];
  itemTypeOptions: string[];
  communicationPolicyOptions: string[];
  vendorsLoading?: boolean;
  itemTypesLoading?: boolean;
  communicationPoliciesLoading?: boolean;
  onValueChange: (key: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function DeviceForm({
  formId,
  formTitle,
  formSubtitle,
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
  isSaving = false,
}: DeviceFormProps) {
  const [selectedIcon, setSelectedIcon] = useState(values.icon || "");
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const projectValue = String(values.project || "").replace(/\s+/g, "_");
  
  // Icon options
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

  const handleIconSelect = (icon: string) => {
    setSelectedIcon(icon);
    onValueChange("icon", icon);
    setShowIconDropdown(false);
  };

  useEffect(() => {
    setSelectedIcon(values.icon || "");
  }, [values.icon]);

  return (
    <div className="inventory-form-theme p-7">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0f2554]">
          {formTitle}
        </h2>
        <p className="mt-1 text-sm text-[#5f6f8a]">{formSubtitle}</p>
      </div>

      <form id={formId} onSubmit={onSubmit} className="space-y-5">
        {/* Device Name */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">
              Device Name <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={values.name || ""}
              required
              placeholder="Enter device name"
              onChange={(e) => onValueChange("name", e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
            />
          </label>
        </div>

        {/* Foreign ID */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">Foreign ID</span>
            <input
              type="text"
              value={values.foreignId || ""}
              onChange={(e) => onValueChange("foreignId", e.target.value)}
              placeholder="Optional external thing/device id"
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
            />
          </label>
        </div>

        {/* Gateway Foreign ID */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">Gateway Foreign ID</span>
            <input
              type="text"
              value={values.gatewayForeignId || ""}
              onChange={(e) => onValueChange("gatewayForeignId", e.target.value)}
              placeholder="Enter gateway foreign ID"
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
            />
          </label>
        </div>

        <div className="border-t border-[#dce2ea] pt-5 mt-5">
          <h3 className="text-lg font-medium text-[#0f2554] mb-4">Catalog Binding</h3>

          <div className="mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334664]">Vendor</span>
              <select
                value={values.vendorName || ""}
                onChange={(e) => onValueChange("vendorName", e.target.value)}
                className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a98ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "16px" }}
              >
                <option value="">{vendorsLoading ? "Loading vendors..." : "Select vendor"}</option>
                {vendorOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334664]">Item Type</span>
              <select
                value={values.itemTypeName || ""}
                onChange={(e) => onValueChange("itemTypeName", e.target.value)}
                className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a98ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "16px" }}
              >
                <option value="">{itemTypesLoading ? "Loading item types..." : "Select item type"}</option>
                {itemTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334664]">Communication Policy</span>
              <select
                value={values.communicationPolicy || ""}
                onChange={(e) => onValueChange("communicationPolicy", e.target.value)}
                className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a98ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "16px" }}
              >
                <option value="">
                  {communicationPoliciesLoading ? "Loading policies..." : "Select communication policy"}
                </option>
                {communicationPolicyOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Serial Number */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">
              Serial Number <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={values.serialNumber || ""}
              required
              placeholder="Enter serial number"
              onChange={(e) => onValueChange("serialNumber", e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
            />
          </label>
        </div>

        {/* Image Upload */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">Image</span>
            <div className="border-2 border-dashed border-[#d7dde6] rounded-[12px] bg-[#f8fafd] p-6 text-center transition-colors hover:border-[#5ea2f2]">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                multiple
                className="hidden"
                id="device-images"
              />
              <label htmlFor="device-images" className="cursor-pointer">
                <span className="text-sm text-[#5f6f8a]">
                  Drop your images here, or <span className="text-[#3d95f5] font-medium underline underline-offset-2">browse</span>
                </span>
                <br />
                <span className="text-xs text-[#8a98ae]">Supports PNG, JPG & WEBP up to 10MB</span>
              </label>
            </div>
          </label>
        </div>

        {/* Icon Selection */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">
              Icon <span className="text-red-500">*</span>
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconDropdown(!showIconDropdown)}
                className="w-full h-11 rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-left text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 flex justify-between items-center"
              >
                <span className={selectedIcon ? "text-[#25334d]" : "text-[#8a98ae]"}>
                  {selectedIcon || "Select an Icon"}
                </span>
                <ChevronDown size={16} className="text-[#8a98ae]" />
              </button>
              
              {showIconDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-[#d7dde6] rounded-[10px] shadow-lg max-h-48 overflow-y-auto">
                  {icons.map((icon) => (
                    <div
                      key={icon}
                      onClick={() => handleIconSelect(icon)}
                      className="px-4 py-2.5 hover:bg-[#f5f7fa] cursor-pointer text-sm text-[#25334d] transition-colors"
                    >
                      {icon}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Connection Type */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">
              Connection Type <span className="text-red-500">*</span>
            </span>
            <select
              value={values.connectionType || ""}
              required
              onChange={(e) => onValueChange("connectionType", e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a98ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "16px" }}
            >
              <option value="" disabled>Select connection type</option>
              <option value="API">API</option>
              <option value="MQTT">MQTT</option>
              <option value="WEBSOCKET">WEBSOCKET</option>
              <option value="BLUETOOTH">BLUETOOTH</option>
              <option value="WIFI">WIFI</option>
            </select>
          </label>
        </div>

        {/* Project */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">
              Project <span className="text-red-500">*</span>
            </span>
            <select
              value={projectValue}
              required
              onChange={(e) => onValueChange("project", e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a98ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "16px" }}
            >
              <option value="" disabled>Select project</option>
              <option value="project_a">project_a</option>
              <option value="project_b">project_b</option>
              <option value="project_c">project_c</option>
              <option value="project_d">project_d</option>
            </select>
          </label>
        </div>

        {/* Metadata */}
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#334664]">Metadata</span>
            <textarea
              value={values.metadata || ""}
              onChange={(e) => onValueChange("metadata", e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 py-2.5 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10 font-mono resize-none"
              placeholder="{}"
            />
          </label>
        </div>

        {/* Address Section */}
        <div className="border-t border-[#dce2ea] pt-5 mt-5">
          <h3 className="text-lg font-medium text-[#0f2554] mb-4">Address</h3>
          
          {/* Address Line */}
          <div className="mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334664]">Address *</span>
              <input
                type="text"
                value={values.address || ""}
                onChange={(e) => onValueChange("address", e.target.value)}
                placeholder="Enter address"
                className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
              />
            </label>
          </div>

          {/* Address Details */}
          <div className="mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334664]">Address Details *</span>
              <input
                type="text"
                value={values.addressDetails || ""}
                onChange={(e) => onValueChange("addressDetails", e.target.value)}
                placeholder="Enter address details"
                className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
              />
            </label>
          </div>

          {/* Address Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* House/Building No */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">House/Building No.</span>
                <input
                  type="text"
                  value={values.houseNo || ""}
                  onChange={(e) => onValueChange("houseNo", e.target.value)}
                  placeholder="Enter house/building no"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* Block */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">Block</span>
                <input
                  type="text"
                  value={values.block || ""}
                  onChange={(e) => onValueChange("block", e.target.value)}
                  placeholder="Enter block"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* Street */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">Street</span>
                <input
                  type="text"
                  value={values.street || ""}
                  onChange={(e) => onValueChange("street", e.target.value)}
                  placeholder="Enter street"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* City */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">City</span>
                <input
                  type="text"
                  value={values.city || ""}
                  onChange={(e) => onValueChange("city", e.target.value)}
                  placeholder="Enter city"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* State */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">State</span>
                <input
                  type="text"
                  value={values.state || ""}
                  onChange={(e) => onValueChange("state", e.target.value)}
                  placeholder="Enter state"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* Country */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">Country</span>
                <input
                  type="text"
                  value={values.country || ""}
                  onChange={(e) => onValueChange("country", e.target.value)}
                  placeholder="Enter country"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>

            {/* ZIP Code */}
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334664]">ZIP Code</span>
                <input
                  type="text"
                  value={values.zipCode || ""}
                  onChange={(e) => onValueChange("zipCode", e.target.value)}
                  placeholder="Enter ZIP code"
                  className="h-11 w-full rounded-[10px] border border-[#d7dde6] bg-white px-4 text-sm text-[#25334d] outline-none transition-colors focus:border-[#5ea2f2] focus:ring-2 focus:ring-[#5ea2f2]/10"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 border-t border-[#dce2ea] pt-6 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-[#d7dde6] bg-white px-6 py-2.5 text-sm font-medium text-[#324260] transition-all hover:bg-[#f8fafd] hover:border-[#5ea2f2] active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[10px] bg-[#3d95f5] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#2e84e2] hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Create Device"}
          </button>
        </div>

        {editing && (
          <p className="mt-4 rounded-lg border border-[#e5d3a9] bg-[#f8f1de] px-4 py-2.5 text-xs text-[#826835]">
            You are editing an existing device record. Changes will be saved to this device.
          </p>
        )}
      </form>
    </div>
  );
}

// ChevronDown component for the icon dropdown
function ChevronDown({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}
