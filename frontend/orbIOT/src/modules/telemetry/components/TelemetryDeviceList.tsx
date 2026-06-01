import { Activity, AlertTriangle, ChevronRight, Cpu } from "lucide-react";
import type { TelemetryDeviceGroup } from "../types";

function statusTone(status: TelemetryDeviceGroup["connectionStatus"]) {
  if (status === "connected") return "bg-[#eef9ef] text-[#155d27]";
  if (status === "error") return "bg-[#fff3ef] text-[#b55c45]";
  if (status === "disconnected") return "bg-[#fff8e7] text-[#8a6511]";
  return "bg-[#f1f3ec] text-[#6f7468]";
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
    <aside className="rounded-[24px] border border-[var(--iotiq-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">Devices</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">Switch between MQTT activity feeds per device.</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
            selectedDeviceId === null ? "bg-[#111111] text-white" : "bg-[#fafaf5] text-[var(--iotiq-muted)]"
          }`}
        >
          All
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const active = selectedDeviceId === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                active
                  ? "border-[#d7e7ce] bg-[var(--iotiq-active)] shadow-[0_10px_22px_rgba(17,17,17,0.04)]"
                  : "border-[var(--iotiq-border)] bg-[#fafaf5] hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#161616]">{group.label}</p>
                  <p className="mt-1 truncate text-[11px] text-[var(--iotiq-muted)]">{group.serialNumber}</p>
                </div>
                <ChevronRight size={16} className={active ? "text-[#155d27]" : "text-[var(--iotiq-muted)]"} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
                <span className={`rounded-full px-2 py-1 ${statusTone(group.connectionStatus)}`}>{group.connectionStatus}</span>
                <span className="rounded-full bg-[#f3f4ef] px-2 py-1 text-[var(--iotiq-muted)]">{group.connectionType}</span>
                {group.errorCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3ef] px-2 py-1 text-[#b55c45]">
                    <AlertTriangle size={11} />
                    {group.errorCount} error
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eef9ef] px-2 py-1 text-[#155d27]">
                    <Activity size={11} />
                    healthy
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--iotiq-muted)]">
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
