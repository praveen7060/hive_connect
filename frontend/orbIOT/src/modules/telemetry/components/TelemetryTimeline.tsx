import { AlertTriangle, ArrowUpRight, ChevronRight, Download, Upload } from "lucide-react";
import type { TelemetryLogEntry } from "../types";

function tone(status: TelemetryLogEntry["connectionStatus"]) {
  if (status === "connected") return "bg-[#eef9ef] text-[#155d27]";
  if (status === "error") return "bg-[#fff3ef] text-[#b55c45]";
  if (status === "disconnected") return "bg-[#fff8e7] text-[#8a6511]";
  return "bg-[#f1f3ec] text-[#6f7468]";
}

export function TelemetryTimeline({
  entries,
  selectedLogId,
  animatedIds,
  onSelect,
}: {
  entries: TelemetryLogEntry[];
  selectedLogId: string | null;
  animatedIds: Set<string>;
  onSelect: (log: TelemetryLogEntry) => void;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--iotiq-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">MQTT timeline</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">Recent device-wise broker activity with payload and state markers.</p>
        </div>
        <span className="rounded-full bg-[#fafaf5] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">
          {entries.length} entries
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {entries.map((entry, index) => {
          const isSelected = selectedLogId === entry.id;
          const isAnimated = animatedIds.has(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className={[
                "telemetry-timeline-entry relative w-full rounded-[18px] border px-4 py-4 text-left transition",
                isSelected
                  ? "border-[#d7e7ce] bg-[var(--iotiq-active)] shadow-[0_12px_24px_rgba(17,17,17,0.05)]"
                  : "border-[var(--iotiq-border)] bg-[#fafaf5] hover:bg-white",
                isAnimated ? "telemetry-log-enter" : "",
              ].join(" ")}
            >
              <span className={`absolute left-5 top-0 h-full w-px ${index === entries.length - 1 ? "bg-transparent" : "bg-[#e8ebdf]"}`} />
              <span className={`absolute left-[15px] top-6 h-3.5 w-3.5 rounded-full border-2 border-white ${entry.connectionStatus === "connected" ? "bg-[#7caf63]" : entry.connectionStatus === "error" ? "bg-[#e07c62]" : entry.connectionStatus === "disconnected" ? "bg-[#d9b14a]" : "bg-[#b8beb2]"}`} />

              <div className="ml-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-[#161616]">{entry.deviceName}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${tone(entry.connectionStatus)}`}>
                        {entry.connectionStatus}
                      </span>
                      <span className="rounded-full bg-[#f1f3ec] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--iotiq-muted)]">
                        {entry.messageType}
                      </span>
                      <span className="rounded-full bg-[#f7f6ef] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#8a6511]">
                        {entry.qos === "—" ? "QoS N/A" : `QoS ${entry.qos}`}
                      </span>
                    </div>

                    <p className="mt-2 text-[12px] text-[#161616]">{entry.payloadSummary}</p>
                    <p className="mt-1 truncate text-[11px] text-[var(--iotiq-muted)]">{entry.topic || "Topic unavailable"}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--iotiq-muted)]">
                      {entry.direction === "incoming" ? <Download size={11} /> : entry.direction === "outgoing" ? <Upload size={11} /> : <ArrowUpRight size={11} />}
                      {entry.direction}
                    </span>
                    <ChevronRight size={16} className={isSelected ? "text-[#155d27]" : "text-[var(--iotiq-muted)]"} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--iotiq-muted)]">
                  <span>Device ID: {entry.deviceId}</span>
                  <span>Thing ID: {entry.thingId}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  {entry.errorDetails ? (
                    <span className="inline-flex items-center gap-1 text-[#b55c45]">
                      <AlertTriangle size={12} />
                      {entry.errorDetails}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
