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
    <div className="rounded-[24px] border border-[var(--iotiq-border)] bg-white p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-3">
          <Search size={16} className="text-[var(--iotiq-muted)]" />
          <input
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search device ID, thing ID, topic, or payload keyword"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#161616] outline-none placeholder:text-[#a1a69a]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fafaf5] px-3 py-2 text-[12px] font-medium text-[#161616] transition hover:bg-white"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onTogglePolling}
            className={`rounded-full px-3 py-2 text-[12px] font-medium transition ${
              pollingEnabled ? "bg-[#111111] text-white" : "border border-[var(--iotiq-border)] bg-[#fafaf5] text-[#161616]"
            }`}
          >
            {pollingEnabled ? "Polling on" : "Polling off"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#eef9ef] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#155d27]">
          <SlidersHorizontal size={13} />
          Filters
        </span>

        <select
          value={filters.timeRange}
          onChange={(event) => onChange({ ...filters, timeRange: event.target.value as TelemetryTimeRange })}
          className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2 text-[12px] text-[#161616]"
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
          className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2 text-[12px] text-[#161616] placeholder:text-[#a1a69a]"
        />

        <select
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as TelemetryFilters["status"] })}
          className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2 text-[12px] text-[#161616]"
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
          className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2 text-[12px] text-[#161616]"
        >
          <option value="">All message types</option>
          {availableTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-2 text-[12px] text-[#161616]">
          <input
            type="checkbox"
            checked={filters.errorOnly}
            onChange={(event) => onChange({ ...filters, errorOnly: event.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--iotiq-primary)]"
          />
          Error logs only
        </label>
      </div>
    </div>
  );
}
