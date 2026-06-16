import { Activity, AlertTriangle, ChevronRight, Cpu } from "lucide-react";
import type { TelemetryDeviceGroup } from "../types";

function statusTone(status: TelemetryDeviceGroup["connectionStatus"]) {
  if (status === "connected") return "bg-[#dffbef] text-[#059669] border-[#98f0c5]";
  if (status === "error") return "bg-[#fff1f2] text-[#ef4444] border-[#fecaca]";
  if (status === "disconnected") return "bg-[#fff7dd] text-[#d97706] border-[#fcd66c]";
  return "bg-[#eef2f7] text-[#64748b] border-[#d8e0ea]";
}

export function TelemetryDeviceList({
  groups,
  selectedDeviceId,
  onSelect,
}: {
  groups: TelemetryDeviceGroup[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string | null) => void;
}) {
  return (
    <aside className="rounded-[20px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold text-[#111827]">Devices</p>
          <p className="mt-1 text-[13px] font-medium text-[#90a0b8]">Switch between MQTT activity feeds.</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
            selectedDeviceId === null ? "bg-[#0f172a] text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]" : "border border-[#dbe4ef] bg-white text-[#64748b]"
          }`}
        >
          All
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {groups.map((group) => {
          const active = selectedDeviceId === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`w-full rounded-[16px] border px-4 py-4 text-left transition ${
                active
                  ? "border-[#bfdbfe] bg-[#eff6ff] shadow-[0_10px_22px_rgba(47,109,246,0.10)]"
                  : "border-[#e5ebf4] bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[#111827]">{group.label}</p>
                  <p className="mt-1 truncate text-[12px] font-medium text-[#90a0b8]">{group.serialNumber}</p>
                </div>
                <ChevronRight size={16} className={active ? "text-[#2f6df6]" : "text-[#94a3b8]"} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                <span className={`rounded-full border px-2 py-1 ${statusTone(group.connectionStatus)}`}>{group.connectionStatus}</span>
                <span className="rounded-full border border-[#dbe4ef] bg-[#f1f6fb] px-2 py-1 text-[#64748b]">{group.connectionType}</span>
                {group.errorCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f2] px-2 py-1 text-[#ef4444]">
                    <AlertTriangle size={11} />
                    {group.errorCount} error
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e8fbf2] px-2 py-1 text-[#059669]">
                    <Activity size={11} />
                    healthy
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[12px] font-medium text-[#90a0b8]">
                <span className="inline-flex items-center gap-1 truncate">
                  <Cpu size={12} />
                  {group.thingId}
                </span>
                <span>{group.logCount} logs</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
