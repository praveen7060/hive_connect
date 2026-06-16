import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type { TelemetryFilters, TelemetryHealth, TelemetryTimeRange } from "../types";

const timeRanges: TelemetryTimeRange[] = ["1h", "24h", "7d", "30d", "all"];
const statuses: Array<"all" | TelemetryHealth> = ["all", "connected", "disconnected", "error", "unknown"];

export function TelemetryFiltersBar({
  filters,
  availableTypes,
  refreshing,
  pollingEnabled,
  onChange,
  onRefresh,
  onTogglePolling,
}: {
  filters: TelemetryFilters;
  availableTypes: string[];
  refreshing: boolean;
  pollingEnabled: boolean;
  onChange: (next: TelemetryFilters) => void;
  onRefresh: () => void;
  onTogglePolling: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[#dbe4ef] bg-white px-5 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
          <Search size={18} className="text-[#94a3b8]" />
          <input
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search device ID, thing ID, topic, or payload keyword"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-[52px] items-center gap-2 rounded-2xl border border-[#dbe4ef] bg-white px-4 text-[13px] font-bold text-[#334155] shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-[#2f6df6] hover:text-[#2f6df6]"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onTogglePolling}
            className={`h-[52px] rounded-2xl px-4 text-[13px] font-bold transition ${
              pollingEnabled ? "bg-[#0f172a] text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]" : "border border-[#dbe4ef] bg-white text-[#334155]"
            }`}
          >
            {pollingEnabled ? "Polling on" : "Polling off"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#eef4ff] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6df6]">
          <SlidersHorizontal size={13} />
          Filters
        </span>

        <select
          value={filters.timeRange}
          onChange={(event) => onChange({ ...filters, timeRange: event.target.value as TelemetryTimeRange })}
          className="h-11 rounded-xl border border-[#dbe4ef] bg-white px-3 text-[13px] font-semibold text-[#334155]"
        >
          {timeRanges.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>

        <input
          value={filters.topic}
          onChange={(event) => onChange({ ...filters, topic: event.target.value })}
          placeholder="Filter by topic"
          className="h-11 rounded-xl border border-[#dbe4ef] bg-white px-3 text-[13px] font-semibold text-[#334155] placeholder:text-[#94a3b8]"
        />

        <select
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as TelemetryFilters["status"] })}
          className="h-11 rounded-xl border border-[#dbe4ef] bg-white px-3 text-[13px] font-semibold text-[#334155]"
        >
          {statuses.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All statuses" : option}
            </option>
          ))}
        </select>

        <select
          value={filters.messageType}
          onChange={(event) => onChange({ ...filters, messageType: event.target.value })}
          className="h-11 rounded-xl border border-[#dbe4ef] bg-white px-3 text-[13px] font-semibold text-[#334155]"
        >
          <option value="">All message types</option>
          {availableTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#dbe4ef] bg-white px-3 text-[13px] font-semibold text-[#334155]">
          <input
            type="checkbox"
            checked={filters.errorOnly}
            onChange={(event) => onChange({ ...filters, errorOnly: event.target.checked })}
            className="h-3.5 w-3.5 accent-[#2f6df6]"
          />
          Error logs only
        </label>
      </div>
    </div>
  );
}
