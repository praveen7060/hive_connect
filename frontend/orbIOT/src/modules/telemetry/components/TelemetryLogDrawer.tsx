import { Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { TelemetryLogEntry } from "../types";

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function TelemetryLogDrawer({
  entry,
  onClose,
}: {
  entry: TelemetryLogEntry | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const payloadJson = useMemo(() => prettyJson(entry?.payload), [entry?.payload]);
  const runtimeJson = useMemo(() => prettyJson(entry?.runtimeMetadata), [entry?.runtimeMetadata]);
  const deviceJson = useMemo(() => prettyJson(entry?.deviceMetadata), [entry?.deviceMetadata]);
  const certificateInfo = useMemo(() => {
    if (!entry) return "Certificate/reference details unavailable in this telemetry snapshot.";
    const onboarding = entry.deviceMetadata.onboarding;
    if (!onboarding) {
      return "Certificate/reference details unavailable in this telemetry snapshot.";
    }
    return prettyJson(onboarding);
  }, [entry]);

  if (!entry) return null;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="inventory-drawer-overlay fixed inset-0 z-50 bg-[#10120f]/18 backdrop-blur-[2px]">
      <div className="absolute inset-y-5 right-5 w-[min(560px,calc(100vw-1.5rem))] rounded-[28px] border border-[var(--iotiq-border)] bg-white shadow-[0_28px_80px_rgba(17,17,17,0.14)] inventory-drawer-panel">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="sticky top-0 z-10 border-b border-[var(--iotiq-border)] bg-white/96 px-5 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">MQTT log details</p>
                <h3 className="mt-2 truncate text-[24px] font-medium tracking-[-0.05em] text-[#161616]">{entry.deviceName}</h3>
                <p className="mt-2 text-[12px] text-[var(--iotiq-muted)]">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--iotiq-border)] bg-[#fafaf5] p-2 text-[var(--iotiq-muted)] transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <section className="grid gap-3 sm:grid-cols-2">
              {[
                ["Device ID", entry.deviceId],
                ["Thing ID", entry.thingId],
                ["Topic", entry.topic || "Unavailable"],
                ["Direction", entry.direction],
                ["Connection", entry.connectionStatus],
                ["Broker status", entry.brokerStatus],
              ].map(([label, value]) => (
                <article key={label} className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">{label}</p>
                    <button
                      type="button"
                      onClick={() => copy(label, value)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--iotiq-muted)]"
                    >
                      <Copy size={12} />
                      {copied === label ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 break-all text-[13px] font-medium text-[#161616]">{value}</p>
                </article>
              ))}
            </section>

            <section className="space-y-3">
              <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--iotiq-border)] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#161616]">Payload</p>
                  <button
                    type="button"
                    onClick={() => copy("Payload", payloadJson)}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--iotiq-muted)]"
                  >
                    <Copy size={12} />
                    {copied === "Payload" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-[220px] overflow-auto px-4 py-4 text-[12px] leading-6 text-[#161616]">{payloadJson || "Payload unavailable"}</pre>
              </div>

              <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-white">
                <div className="border-b border-[var(--iotiq-border)] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#161616]">Runtime metadata</p>
                </div>
                <pre className="max-h-[220px] overflow-auto px-4 py-4 text-[12px] leading-6 text-[#161616]">{runtimeJson}</pre>
              </div>

              <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-white">
                <div className="border-b border-[var(--iotiq-border)] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#161616]">Device metadata</p>
                </div>
                <pre className="max-h-[220px] overflow-auto px-4 py-4 text-[12px] leading-6 text-[#161616]">{deviceJson}</pre>
              </div>

              <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-white">
                <div className="border-b border-[var(--iotiq-border)] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#161616]">Certificate / reference info</p>
                </div>
                <pre className="max-h-[180px] overflow-auto px-4 py-4 text-[12px] leading-6 text-[#161616]">{certificateInfo}</pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
