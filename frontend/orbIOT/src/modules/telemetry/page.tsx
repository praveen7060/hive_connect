import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Cpu, RefreshCw, Wifi } from "lucide-react";
import { filterTelemetryLogs, useTelemetryAnimations, useTelemetryLogs } from "./hooks";
import type { TelemetryFilters, TelemetryLogEntry } from "./types";
import { TelemetryDeviceList } from "./components/TelemetryDeviceList";
import { TelemetryEmptyState, TelemetryErrorState, TelemetrySkeleton } from "./components/TelemetryStates";
import { TelemetryFiltersBar } from "./components/TelemetryFiltersBar";
import { TelemetryTimeline } from "./components/TelemetryTimeline";
import { TelemetryLogDrawer } from "./components/TelemetryLogDrawer";

const defaultFilters: TelemetryFilters = {
  search: "",
  topic: "",
  status: "all",
  messageType: "",
  timeRange: "24h",
  errorOnly: false,
};

function formatRelative(value: string | null) {
  if (!value) return "Not loaded yet";
  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  return `${Math.floor(diffMinutes / 1440)} day ago`;
}

export default function TelemetryPage() {
  const [filters, setFilters] = useState<TelemetryFilters>(defaultFilters);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<TelemetryLogEntry | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const { groups, loading, error, refreshing, lastLoadedAt, reload } = useTelemetryLogs(pollingEnabled, 15000);

  useEffect(() => {
    if (selectedDeviceId && !groups.some((group) => group.id === selectedDeviceId)) {
      setSelectedDeviceId(null);
    }
  }, [groups, selectedDeviceId]);

  const filteredGroups = useMemo(
    () => filterTelemetryLogs(groups, filters, selectedDeviceId),
    [filters, groups, selectedDeviceId]
  );

  const visibleEntries = useMemo(
    () => filteredGroups.flatMap((group) => group.logs).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filteredGroups]
  );

  const animatedIds = useTelemetryAnimations(filteredGroups);
  const availableTypes = useMemo(
    () => Array.from(new Set(groups.flatMap((group) => group.messageTypes))).sort(),
    [groups]
  );

  const stats = useMemo(() => {
    const baseGroups = selectedDeviceId ? groups.filter((group) => group.id === selectedDeviceId) : groups;
    const allEntries = baseGroups.flatMap((group) => group.logs);
    return {
      devices: baseGroups.length,
      logs: allEntries.length,
      connected: allEntries.filter((entry) => entry.connectionStatus === "connected").length,
      errors: allEntries.filter((entry) => entry.connectionStatus === "error" || Boolean(entry.errorDetails)).length,
    };
  }, [groups, selectedDeviceId]);

  const activeGroup = selectedDeviceId ? groups.find((group) => group.id === selectedDeviceId) ?? null : null;

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">MQTT telemetry</p>
            <h2 className="mt-2 text-[24px] font-medium tracking-[-0.05em] text-[#161616]">Device-wise message activity</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--iotiq-muted)]">
              Inspect recent MQTT telemetry grouped by device, follow timeline events, and open raw payload details without leaving the page.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--iotiq-primary)]">
                <Cpu size={14} />
                <span className="text-[10px] uppercase tracking-[0.16em]">Devices</span>
              </div>
              <p className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-[#161616]">{stats.devices}</p>
            </article>
            <article className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--iotiq-primary)]">
                <Activity size={14} />
                <span className="text-[10px] uppercase tracking-[0.16em]">Messages</span>
              </div>
              <p className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-[#161616]">{stats.logs}</p>
            </article>
            <article className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--iotiq-primary)]">
                <Wifi size={14} />
                <span className="text-[10px] uppercase tracking-[0.16em]">Connected</span>
              </div>
              <p className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-[#161616]">{stats.connected}</p>
            </article>
            <article className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
              <div className="flex items-center gap-2 text-[#b55c45]">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                <span className="text-[10px] uppercase tracking-[0.16em]">Errors</span>
              </div>
              <p className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-[#161616]">{stats.errors}</p>
            </article>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-[var(--iotiq-muted)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef9ef] px-3 py-1.5 text-[#155d27]">
            <Clock3 size={13} />
            Last loaded {formatRelative(lastLoadedAt)}
          </span>
          {activeGroup ? (
            <span className="rounded-full bg-[#fff8e7] px-3 py-1.5 text-[#8a6511]">
              Focused on {activeGroup.label}
            </span>
          ) : (
            <span className="rounded-full bg-[#fafaf5] px-3 py-1.5">Viewing all device feeds</span>
          )}
        </div>
      </div>

      <TelemetryFiltersBar
        filters={filters}
        availableTypes={availableTypes}
        refreshing={refreshing}
        pollingEnabled={pollingEnabled}
        onChange={setFilters}
        onRefresh={() => void reload()}
        onTogglePolling={() => setPollingEnabled((value) => !value)}
      />

      {loading ? (
        <TelemetrySkeleton />
      ) : error ? (
        <TelemetryErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <TelemetryDeviceList groups={groups} selectedDeviceId={selectedDeviceId} onSelect={setSelectedDeviceId} />

          {visibleEntries.length === 0 ? (
            <TelemetryEmptyState onRefresh={() => void reload()} />
          ) : (
            <TelemetryTimeline
              entries={visibleEntries}
              selectedLogId={selectedLog?.id ?? null}
              animatedIds={animatedIds}
              onSelect={setSelectedLog}
            />
          )}
        </div>
      )}

      <TelemetryLogDrawer entry={selectedLog} onClose={() => setSelectedLog(null)} />
    </section>
  );
}
