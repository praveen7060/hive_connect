import { AlertTriangle, ArrowUpRight, ChevronRight, Download, Upload } from "lucide-react";
import type { TelemetryLogEntry } from "../types";

function tone(status: TelemetryLogEntry["connectionStatus"]) {
  if (status === "connected") return "bg-[#dffbef] text-[#059669] border-[#98f0c5]";
  if (status === "error") return "bg-[#fff1f2] text-[#ef4444] border-[#fecaca]";
  if (status === "disconnected") return "bg-[#fff7dd] text-[#d97706] border-[#fcd66c]";
  return "bg-[#eef2f7] text-[#64748b] border-[#d8e0ea]";
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
    <div className="rounded-[20px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold text-[#111827]">MQTT timeline</p>
          <p className="mt-1 text-[13px] font-medium text-[#90a0b8]">Recent device-wise broker activity with payload and state markers.</p>
        </div>
        <span className="rounded-full bg-[#eef4ff] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6df6]">
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
                "telemetry-timeline-entry relative w-full rounded-[16px] border px-5 py-5 text-left transition",
                isSelected
                  ? "border-[#bfdbfe] bg-[#eff6ff] shadow-[0_12px_24px_rgba(47,109,246,0.10)]"
                  : "border-[#e5ebf4] bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]",
                isAnimated ? "telemetry-log-enter" : "",
              ].join(" ")}
            >
              <span className={`absolute left-6 top-0 h-full w-px ${index === entries.length - 1 ? "bg-transparent" : "bg-[#dbe4ef]"}`} />
              <span className={`absolute left-[19px] top-7 h-3.5 w-3.5 rounded-full border-2 border-white ${entry.connectionStatus === "connected" ? "bg-[#10b981]" : entry.connectionStatus === "error" ? "bg-[#ef4444]" : entry.connectionStatus === "disconnected" ? "bg-[#f59e0b]" : "bg-[#94a3b8]"}`} />

              <div className="ml-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-bold text-[#111827]">{entry.deviceName}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone(entry.connectionStatus)}`}>
                        {entry.connectionStatus}
                      </span>
                      <span className="rounded-full border border-[#dbe4ef] bg-[#f1f6fb] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">
                        {entry.messageType}
                      </span>
                      <span className="rounded-full bg-[#fff7dd] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d97706]">
                        {entry.qos === "—" ? "QoS N/A" : `QoS ${entry.qos}`}
                      </span>
                    </div>

                    <p className="mt-3 text-[13px] font-semibold text-[#334155]">{entry.payloadSummary}</p>
                    <p className="mt-1 truncate text-[12px] font-medium text-[#90a0b8]">{entry.topic || "Topic unavailable"}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#dbe4ef] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">
                      {entry.direction === "incoming" ? <Download size={11} /> : entry.direction === "outgoing" ? <Upload size={11} /> : <ArrowUpRight size={11} />}
                      {entry.direction}
                    </span>
                    <ChevronRight size={16} className={isSelected ? "text-[#2f6df6]" : "text-[#94a3b8]"} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-medium text-[#90a0b8]">
                  <span>Device ID: {entry.deviceId}</span>
                  <span>Thing ID: {entry.thingId}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  {entry.errorDetails ? (
                    <span className="inline-flex items-center gap-1 text-[#ef4444]">
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
