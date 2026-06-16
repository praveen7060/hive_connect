export function TelemetrySkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-[20px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-[16px] border border-[#e5ebf4] bg-white px-4 py-4">
            <div className="h-3 w-24 rounded-full bg-[#e2e8f0]" />
            <div className="mt-3 h-4 w-36 rounded-full bg-[#e2e8f0]" />
            <div className="mt-2 h-3 w-28 rounded-full bg-[#eef2f7]" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-[20px] border border-[#e5ebf4] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-[16px] border border-[#e5ebf4] bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-44 rounded-full bg-[#e2e8f0]" />
              <div className="h-3 w-20 rounded-full bg-[#e2e8f0]" />
            </div>
            <div className="mt-3 h-3 w-full rounded-full bg-[#eef2f7]" />
            <div className="mt-2 h-3 w-3/4 rounded-full bg-[#eef2f7]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelemetryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[20px] border border-[#fecaca] bg-[#fff7f7] px-5 py-10 text-center shadow-[0_14px_34px_rgba(239,68,68,0.08)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ef4444]">Telemetry unavailable</p>
      <p className="mt-3 text-[14px] font-medium text-[#991b1b]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#0f172a] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#1e293b]"
      >
        Retry loading logs
      </button>
    </div>
  );
}

export function TelemetryEmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white px-5 py-12 text-center shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#64748b]">No MQTT activity</p>
      <p className="mt-3 text-[14px] font-medium text-[#90a0b8]">
        No telemetry logs were found for the current filters. Try a broader time range or refresh after devices publish again.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-5 inline-flex items-center justify-center rounded-xl border border-[#dbe4ef] bg-white px-5 py-3 text-[13px] font-bold text-[#334155] shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-[#2f6df6] hover:text-[#2f6df6]"
      >
        Refresh logs
      </button>
    </div>
  );
}
