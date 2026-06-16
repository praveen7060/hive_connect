import { useEffect, useMemo, useState } from "react";
<<<<<<< Updated upstream
import { Activity, Cpu, RefreshCw, Wifi } from "lucide-react";
=======
import { Activity, Clock3, Cpu, RefreshCw, Wifi } from "lucide-react";
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const statCards = [
    {
      label: "Devices",
      value: stats.devices,
      helper: "publishing telemetry",
      icon: <Cpu size={22} />,
      tone: "bg-[#eef4ff] text-[#2f6df6]",
      bar: "bg-[#2f6df6]",
    },
    {
      label: "Messages",
      value: stats.logs,
      helper: "captured in range",
      icon: <Activity size={22} />,
      tone: "bg-[#e8fbf2] text-[#10b981]",
      bar: "bg-[#10b981]",
    },
    {
      label: "Connected",
      value: stats.connected,
      helper: "healthy log events",
      icon: <Wifi size={22} />,
      tone: "bg-[#ecfeff] text-[#0891b2]",
      bar: "bg-[#0891b2]",
    },
    {
      label: "Errors",
      value: stats.errors,
      helper: "requiring review",
      icon: <RefreshCw size={22} className={refreshing ? "animate-spin" : ""} />,
      tone: "bg-[#fff7ed] text-[#f59e0b]",
      bar: "bg-[#f59e0b]",
    },
  ];

  return (
    <section className="min-h-screen bg-[#f5f8fc] px-8 py-9 lg:px-12">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#2f6df6]">
            IOTIQ Platform - Telemetry
          </p>
          <h1 className="mt-4 text-[40px] font-semibold leading-none text-[#111827] md:text-[44px]">
            Telemetry
          </h1>
          <p className="mt-5 max-w-[920px] text-[18px] font-medium leading-7 text-[#7c8ba1]">
            Inspect MQTT activity, device state events, payload summaries, and broker health from one operational view.
          </p>
        </div>

        <div className="inline-flex h-12 items-center gap-3 rounded-full bg-white px-6 text-[15px] font-semibold text-[#334155] shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dffbef]">
            <span className="h-3 w-3 rounded-full bg-[#10b981]" />
          </span>
          Last loaded {formatRelative(lastLoadedAt)}
        </div>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[20px] border border-[#e5ebf4] bg-white px-7 py-6 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
                {card.icon}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9aa9bd]">
                Live
              </span>
            </div>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9aa9bd]">{card.label}</p>
            <p className="mt-2 text-[42px] font-semibold leading-none text-[#0f172a]">{card.value}</p>
            <div className="mt-5 h-1.5 rounded-full bg-[#edf2f7]">
              <div className={`h-full w-2/3 rounded-full ${card.bar}`} />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#90a0b8]">{card.helper}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[20px] border border-[#e5ebf4] bg-white px-7 py-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-[#71829a]">
          {activeGroup ? (
            <span className="rounded-full bg-[#eef4ff] px-4 py-2 text-[#2f6df6]">
              Focused on {activeGroup.label}
            </span>
          ) : (
            <span className="rounded-full bg-[#f1f6fb] px-4 py-2">Viewing all device feeds</span>
          )}
          <span className="rounded-full bg-[#e8fbf2] px-4 py-2 text-[#059669]">
            Polling {pollingEnabled ? "enabled" : "paused"}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
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
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
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
      </div>
=======

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
>>>>>>> Stashed changes

      <TelemetryLogDrawer entry={selectedLog} onClose={() => setSelectedLog(null)} />
    </section>
  );
}
