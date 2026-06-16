import { Activity, Clock3, ReceiptText, RefreshCw } from "lucide-react";
import { deviceInventoryApi, type EntityId } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type TransactionDeviceRow = {
  id: EntityId;
  name?: string | null;
  serialNumber?: string | null;
  foreignId?: string | null;
  status?: string | null;
  metadata?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type RuntimeLogEntry = {
  at?: unknown;
  topic?: unknown;
  category?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseMetadata(value: string | null | undefined) {
  if (!value?.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRuntime(row: TransactionDeviceRow) {
  const metadata = parseMetadata(row.metadata);
  return isPlainObject(metadata.runtime) ? metadata.runtime : {};
}

function getThingId(row: TransactionDeviceRow, runtime: Record<string, unknown>) {
  return readString(runtime.thingId) || readString(row.foreignId) || "-";
}

function getAliveReply(runtime: Record<string, unknown>) {
  const logs = Array.isArray(runtime.lastTelemetryLog)
    ? runtime.lastTelemetryLog.filter(isPlainObject)
    : [];
  const aliveLog = [...logs]
    .reverse()
    .find((log: RuntimeLogEntry) => {
      const topic = readString(log.topic).toLowerCase();
      const category = readString(log.category).toLowerCase();
      return topic.includes("alive_reply") || category.includes("alive");
    });

  if (aliveLog) {
    const at = readString(aliveLog.at);
    return at ? formatDateTime(at) : "Received";
  }

  return "Waiting";
}

function getState(row: TransactionDeviceRow, runtime: Record<string, unknown>) {
  const lastTelemetry = isPlainObject(runtime.lastTelemetry) ? runtime.lastTelemetry : {};
  const protocolState = isPlainObject(runtime.lastProtocolState) ? runtime.lastProtocolState : {};

  return (
    readString(lastTelemetry.status) ||
    readString(protocolState.status) ||
    readString(row.status) ||
    "unknown"
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes("active") || normalized.includes("connected") || normalized.includes("on")
      ? "bg-[#e8fbf2] text-[#059669]"
      : normalized.includes("error") || normalized.includes("fault") || normalized.includes("failed")
        ? "bg-rose-50 text-rose-700"
        : "bg-[#eef4ff] text-[#2f6df6]";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${tone}`}>
      {value || "-"}
    </span>
  );
}

export default function TransactionsPage() {
  const { rows, loading, error, reload } = useCrudResource<TransactionDeviceRow>(
    deviceInventoryApi.devices,
    { initialRows: [] }
  );

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-[#e5ebf4] bg-white px-6 py-6 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f6df6]">
              <ReceiptText size={14} />
              Transactions
            </div>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#111827]">
              Transaction Log
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] font-medium leading-6 text-[#71829a]">
              Device transaction activity resolved from the latest runtime and telemetry records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dbe4ef] bg-[#f8fbff] px-5 text-[13px] font-semibold text-[#334155] transition hover:bg-white"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[#e5ebf4] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8fbf2] text-[#10b981]">
              <Activity size={18} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-[#111827]">Transactions</p>
              <p className="text-[12px] font-medium text-[#8ca0b8]">{rows.length} device records</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-[#f1f6fb] px-4 py-2 text-[12px] font-semibold text-[#71829a] sm:inline-flex">
            <Clock3 size={14} />
            Latest first
          </div>
        </div>

        {error ? (
          <div className="px-6 py-6">
            <p className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#edf2f7] bg-[#f8fbff]">
                {["Device ID", "Thing ID", "Alive Reply", "State", "Status", "Created At"].map((label) => (
                  <th
                    key={label}
                    className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8ca0b8]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[14px] font-medium text-[#71829a]">
                    Loading transactions...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[14px] font-medium text-[#71829a]">
                    No transactions available.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const runtime = getRuntime(row);
                  const deviceId = readString(row.serialNumber) || readString(row.name) || String(row.id);
                  const state = getState(row, runtime);
                  const status = readString(row.status) || state;

                  return (
                    <tr key={row.id} className="border-b border-[#f0f4f8] last:border-0 hover:bg-[#fbfdff]">
                      <td className="whitespace-nowrap px-6 py-4 text-[13px] font-semibold text-[#111827]">
                        {deviceId}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-[13px] font-medium text-[#71829a]">
                        {getThingId(row, runtime)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-[13px] font-medium text-[#71829a]">
                        {getAliveReply(runtime)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-[13px] font-semibold capitalize text-[#334155]">
                        {state}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusPill value={status} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-[13px] font-medium text-[#71829a]">
                        {formatDateTime(row.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
