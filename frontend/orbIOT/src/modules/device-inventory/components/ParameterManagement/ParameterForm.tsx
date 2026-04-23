import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

interface ParameterFormProps {
  formId: string;
  formTitle: string;
  formSubtitle: string;
  editing: boolean;
  values: Record<string, any>;
  vendorOptions: string[];
  vendorsLoading?: boolean;
  onValueChange: (key: string, value: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onSaveAndNext?: () => void;
  onBack?: () => void;
}

export default function ParameterForm({
  formId,
  formTitle,
  formSubtitle,
  editing,
  values,
  vendorOptions,
  vendorsLoading = false,
  onValueChange,
  onSubmit,
  onCancel,
  onSaveAndNext,
  onBack,
}: ParameterFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isConstant = Boolean(values.isConstant);

  const handleSaveAndNext = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form || !form.reportValidity()) return;

    if (onSaveAndNext) {
      onSaveAndNext();
      return;
    }

    onSubmit();
  };

  return (
    <div className="inventory-form-shell inventory-form-theme slide-in-panel shrink-0 sticky top-8">
      <style>{`
        .form-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #e2e8f0;
          scrollbar-gutter: stable;
        }
        .form-scroll::-webkit-scrollbar { width: 7px; }
        .form-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 99px; }
        .form-scroll::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 99px; }
        .form-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }

        .toggle-track {
          width: 38px;
          height: 22px;
          border-radius: 99px;
          transition: background 0.2s;
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
        }
        .toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px;
          transition: left 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}</style>

      <div
        className="inventory-form-panel bg-white border border-slate-100 shadow-sm flex flex-col overflow-hidden"
        style={{ maxHeight: "calc(100vh - 120px)", borderRadius: "16px" }}
      >
        {/* ── Header ── */}
        <div
          className="inventory-form-header flex-none px-7 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between"
          style={{ borderRadius: "16px 16px 0 0" }}
        >
          <div>
            <h2 className="text-[19px] text-slate-900 font-extrabold tracking-[-0.025em]">{formTitle}</h2>
            <p className="text-[12px] text-slate-500 mt-1">{formSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-col"
        >
        <div
          className="inventory-form-body form-scroll min-h-0 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 300px)" }}
        >
          <div className="px-7 py-6 space-y-6">

            {/* Parameter Name */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 mb-2">
                PARAMETER NAME <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={String(values.name ?? "")}
                required
                placeholder="e.g. heap_control"
                onChange={(e) => onValueChange("name", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>

            {/* Vendors — "Is Constant" removed */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 mb-2">
                VENDORS <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <select
                  value={String(values.vendors ?? "")}
                  required
                  onChange={(e) => onValueChange("vendors", e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-9 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer"
                >
                  <option value="">
                    {vendorsLoading
                      ? "Loading vendors..."
                      : vendorOptions.length > 0
                        ? "Select vendor"
                        : "No vendors available"}
                  </option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor} value={vendor}>
                      {vendor}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Variable Type + Is Constant toggle on the same row */}
            <div>
              <div className="flex items-end justify-between mb-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  VARIABLE TYPE <span className="text-red-500 ml-1">*</span>
                </label>

                {/* Is Constant toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Is Constant</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isConstant}
                    onClick={() => onValueChange("isConstant", !isConstant)}
                    className="toggle-track"
                    style={{ background: isConstant ? "#1e293b" : "#cbd5e1" }}
                  >
                    <span
                      className="toggle-thumb"
                      style={{ left: isConstant ? "19px" : "3px" }}
                    />
                  </button>
                </div>
              </div>

              <div className="relative">
                <select
                  value={String(values.variableType ?? "")}
                  required
                  onChange={(e) => onValueChange("variableType", e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-9 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer"
                >
                  <option value="">Select variable type</option>
                  <option value="STRING">STRING</option>
                  <option value="INTEGER">INTEGER</option>
                  <option value="FLOAT">FLOAT</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="ARRAY">ARRAY</option>
                  <option value="INTEGER_RANGE">INTEGER_RANGE</option>
                  <option value="FLOAT_RANGE">FLOAT_RANGE</option>
                  <option value="ENUM">ENUM</option>
                  <option value="JSON">JSON</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  ADVANCED OPTIONS <span className="text-red-500 ml-1">*</span>
                </span>
                {showAdvanced
                  ? <ChevronUp size={14} className="text-slate-400" />
                  : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {showAdvanced && (
                <div className="p-4 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-2">Pin Count</label>
                    <input
                      type="number"
                      value={String(values.pinCount ?? "")}
                      min="0"
                      placeholder=""
                      onChange={(e) => onValueChange("pinCount", parseInt(e.target.value) || 0)}
                      className="h-10 w-24 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-2">Pin Type</label>
                    <div className="relative max-w-xs">
                      <select
                        value={String(values.pinType ?? "")}
                        onChange={(e) => onValueChange("pinType", e.target.value)}
                        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[13px] text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">Select Pin Type</option>
                        <option value="Digital">Digital</option>
                        <option value="Analog">Analog</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="inventory-form-footer flex-none px-7 py-4 border-t border-slate-100"
          style={{ borderRadius: "0 0 16px 16px" }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack ?? onCancel}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-[13px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
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
        </div>
        </form>

      </div>
    </div>
  );
}
