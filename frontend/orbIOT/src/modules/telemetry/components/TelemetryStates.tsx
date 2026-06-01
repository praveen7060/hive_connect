export function TelemetrySkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-[24px] border border-[var(--iotiq-border)] bg-white p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-[18px] bg-[#f3f5ee] px-4 py-4">
            <div className="h-3 w-24 rounded-full bg-[#e5e8dd]" />
            <div className="mt-3 h-4 w-36 rounded-full bg-[#e5e8dd]" />
            <div className="mt-2 h-3 w-28 rounded-full bg-[#e5e8dd]" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-[24px] border border-[var(--iotiq-border)] bg-white p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-44 rounded-full bg-[#e5e8dd]" />
              <div className="h-3 w-20 rounded-full bg-[#e5e8dd]" />
            </div>
            <div className="mt-3 h-3 w-full rounded-full bg-[#ecefe5]" />
            <div className="mt-2 h-3 w-3/4 rounded-full bg-[#ecefe5]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelemetryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[24px] border border-[#efcfca] bg-[#fff7f5] px-5 py-8 text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#b45d4f]">Telemetry unavailable</p>
      <p className="mt-3 text-[14px] text-[#7b4b43]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#232323]"
      >
        Retry loading logs
      </button>
    </div>
  );
}

export function TelemetryEmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--iotiq-border)] bg-white px-5 py-12 text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">No MQTT activity</p>
      <p className="mt-3 text-[14px] text-[var(--iotiq-muted)]">
        No telemetry logs were found for the current filters. Try a broader time range or refresh after devices publish again.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-5 inline-flex items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-2.5 text-[12px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
      >
        Refresh logs
      </button>
    </div>
  );
}
