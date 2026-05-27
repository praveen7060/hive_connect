import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, AppWindow, ArrowRight, Clock3, HardDrive, Power, QrCode, ShieldCheck, TrendingUp } from "lucide-react";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;
type GenericRow = {
  id: string | number;
  createdAt?: string;
} & Record<string, PrimitiveValue>;

type Timeframe = "hourly" | "weekly" | "monthly";
type DeviceState = "on" | "off" | "unknown";

type StateSnapshot = {
  state: DeviceState;
  lastTelemetryAt: Date | null;
  switchLabel: string;
  topic: string;
};

function parseJsonRecord(value: PrimitiveValue | undefined) {
  if (typeof value !== "string" || !value.trim()) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeState(value: unknown): DeviceState {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "on") return "on";
  if (normalized === "off") return "off";
  return "unknown";
}

function getDeviceSnapshot(row: GenericRow): StateSnapshot {
  const metadata = parseJsonRecord(row.metadata);
  const runtime = metadata.runtime && typeof metadata.runtime === "object" && !Array.isArray(metadata.runtime)
    ? (metadata.runtime as Record<string, unknown>)
    : {};
  const lastTelemetry =
    runtime.lastTelemetry && typeof runtime.lastTelemetry === "object" && !Array.isArray(runtime.lastTelemetry)
      ? (runtime.lastTelemetry as Record<string, unknown>)
      : {};
  const lastProtocolState =
    runtime.lastProtocolState && typeof runtime.lastProtocolState === "object" && !Array.isArray(runtime.lastProtocolState)
      ? (runtime.lastProtocolState as Record<string, unknown>)
      : {};
  const lastTelemetryAtRaw = readString(runtime.lastTelemetryAt);
  const lastTelemetryAt = lastTelemetryAtRaw ? new Date(lastTelemetryAtRaw) : null;
  const switchNo = readString(lastTelemetry.switch_no) || readString(lastTelemetry.switchNo);
  const channel = readString(lastTelemetry.channel);
  const switchParts = [channel ? `CH ${channel}` : "", switchNo ? `S${String(switchNo).replace(/^S/i, "")}` : ""].filter(Boolean);

  return {
    state: normalizeState(lastTelemetry.status ?? lastProtocolState.status),
    lastTelemetryAt: lastTelemetryAt && !Number.isNaN(lastTelemetryAt.getTime()) ? lastTelemetryAt : null,
    switchLabel: switchParts.join(" • ") || "General state",
    topic: readString(runtime.lastTelemetryTopic),
  };
}

function formatRelative(value: Date | null) {
  if (!value) return "No live update";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${Math.floor(diffHours / 24)} day ago`;
}

function isWithinDays(date: Date | null, days: number) {
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function buildStateAnalyticsSeries(rows: GenericRow[], timeframe: Timeframe, target: DeviceState) {
  const now = new Date();
  const formatters: Record<Timeframe, (date: Date) => string> = {
    hourly: (date) => `${String(date.getHours()).padStart(2, "0")}:00`,
    weekly: (date) =>
      date.toLocaleDateString("en-US", {
        weekday: "short",
      }),
    monthly: (date) =>
      date.toLocaleDateString("en-US", {
        month: "short",
      }),
  };

  const seeds: Record<Timeframe, Date[]> = {
    hourly: Array.from({ length: 12 }, (_, index) => {
      const slot = new Date(now);
      slot.setMinutes(0, 0, 0);
      slot.setHours(now.getHours() - (11 - index));
      return slot;
    }),
    weekly: Array.from({ length: 7 }, (_, index) => {
      const slot = new Date(now);
      slot.setHours(0, 0, 0, 0);
      slot.setDate(now.getDate() - (6 - index));
      return slot;
    }),
    monthly: Array.from({ length: 6 }, (_, index) => {
      const slot = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      slot.setHours(0, 0, 0, 0);
      return slot;
    }),
  };

  const slots = seeds[timeframe];
  const bucketMap = new Map<string, number>();
  slots.forEach((slot) => bucketMap.set(formatters[timeframe](slot), 0));

  rows.forEach((row) => {
    const snapshot = getDeviceSnapshot(row);
    if (snapshot.state !== target || !snapshot.lastTelemetryAt) return;

    const key = formatters[timeframe](snapshot.lastTelemetryAt);
    if (!bucketMap.has(key)) return;
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
  });

  return slots.map((slot) => {
    const label = formatters[timeframe](slot);
    return {
      label,
      value: bucketMap.get(label) ?? 0,
    };
  });
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9ef] text-[#155d27]">
          {icon}
        </span>
        <span className="rounded-full bg-[#fff8e7] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#8a6511]">
          Live
        </span>
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">{label}</p>
      <p className="mt-1 text-[28px] font-medium tracking-[-0.05em] text-[#161616]">{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-[var(--iotiq-muted)]">{helper}</p>
    </article>
  );
}

function StateFeed({
  items,
}: {
  items: Array<{
    id: string | number;
    name: string;
    state: DeviceState;
    switchLabel: string;
    updatedAt: Date | null;
  }>;
}) {
  return (
    <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">Recent state updates</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">Latest live device state changes from telemetry</p>
        </div>
        <span className="rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#155d27]">
          Live feed
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--iotiq-border)] px-4 py-8 text-center text-[12px] text-[var(--iotiq-muted)]">
            No telemetry-driven state updates yet.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-[#fafaf5] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#161616]">{item.name}</p>
                  <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{item.switchLabel}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                    item.state === "on"
                      ? "bg-[#eef9ef] text-[#155d27]"
                      : item.state === "off"
                        ? "bg-[#fff8e7] text-[#8a6511]"
                        : "bg-[#f3f4ef] text-[#6f7468]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.state === "on" ? "bg-[#7caf63]" : item.state === "off" ? "bg-[#d9b14a]" : "bg-[#b8beb2]"
                    }`}
                  />
                  {item.state}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--iotiq-muted)]">
                <span>{formatRelative(item.updatedAt)}</span>
                <span>{item.updatedAt ? item.updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "-"}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function AnalyticsChart({
  label,
  helper,
  tone,
  icon,
  data,
}: {
  label: string;
  helper: string;
  tone: "green" | "gold";
  icon: ReactNode;
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((entry) => entry.value), 1);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const barTone = tone === "green" ? "bg-[#86bd67]" : "bg-[#d5ae4b]";
  const badgeTone = tone === "green" ? "bg-[#eef9ef] text-[#155d27]" : "bg-[#fff8e7] text-[#8a6511]";

  return (
    <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">{label}</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">{helper}</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${badgeTone}`}>
          {icon}
          {total}
        </div>
      </div>

      <div className="mt-5 grid h-[170px] grid-cols-6 gap-2 md:grid-cols-12">
        {data.map((entry) => (
          <div key={entry.label} className="flex min-w-0 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end rounded-[16px] bg-[#fafaf5] px-1.5 pb-1.5">
              <div
                className={`w-full rounded-[12px] ${barTone} transition-[height] duration-300`}
                style={{ height: `${Math.max(10, Math.round((entry.value / max) * 100))}%` }}
              />
            </div>
            <div className="space-y-0.5 text-center">
              <p className="truncate text-[10px] font-medium text-[#161616]">{entry.value}</p>
              <p className="truncate text-[9.5px] uppercase tracking-[0.08em] text-[var(--iotiq-muted)]">{entry.label}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("hourly");
  const { rows: devices, loading: devicesLoading } = useCrudResource<GenericRow>(deviceInventoryApi.devices, {
    initialRows: [],
  });
  const { rows: vendors, loading: vendorsLoading } = useCrudResource<GenericRow>(deviceInventoryApi.vendors, {
    initialRows: [],
  });
  const { rows: apps, loading: appsLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.applicationConsoleApps,
    { initialRows: [] }
  );

  const loading = devicesLoading || vendorsLoading || appsLoading;

  const stats = useMemo(() => {
    const snapshots = devices.map((row) => ({ row, snapshot: getDeviceSnapshot(row) }));
    const currentlyOn = snapshots.filter(({ snapshot }) => snapshot.state === "on").length;
    const currentlyOff = snapshots.filter(({ snapshot }) => snapshot.state === "off").length;
    const recentUpdates = snapshots.filter(({ snapshot }) => isWithinDays(snapshot.lastTelemetryAt, 1)).length;
    const staleDevices = snapshots.filter(({ snapshot }) => !isWithinDays(snapshot.lastTelemetryAt, 1)).length;
    const mqttDevices = devices.filter(
      (row) => String(row.connectionType ?? "").trim().toUpperCase() === "MQTT"
    ).length;

    return {
      totalDevices: devices.length,
      currentlyOn,
      currentlyOff,
      recentUpdates,
      staleDevices,
      mqttDevices,
      activeApps: apps.filter((row) => String(row.status ?? "active").trim().toLowerCase() === "active").length,
      vendorCount: vendors.length,
    };
  }, [apps, devices, vendors]);

  const analytics = useMemo(
    () => ({
      on: buildStateAnalyticsSeries(devices, timeframe, "on"),
      off: buildStateAnalyticsSeries(devices, timeframe, "off"),
    }),
    [devices, timeframe]
  );

  const recentStateUpdates = useMemo(
    () =>
      devices
        .map((row) => {
          const snapshot = getDeviceSnapshot(row);
          return {
            id: row.id,
            name: String(row.name ?? row.serialNumber ?? row.id),
            state: snapshot.state,
            switchLabel: snapshot.switchLabel,
            updatedAt: snapshot.lastTelemetryAt,
          };
        })
        .filter((item) => item.updatedAt || item.state !== "unknown")
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
        .slice(0, 6),
    [devices]
  );

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-[var(--iotiq-border)] bg-white px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">Overview</p>
            <h2 className="mt-2 text-[24px] font-medium tracking-[-0.05em] text-[#161616]">
              Live operations snapshot
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--iotiq-muted)]">
              Live ON/OFF state analytics from device telemetry, last sync activity, and operational control updates.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/devices?devicePage&create=true"
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#222222]"
            >
              Create device
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/applications"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fff8e7] px-4 py-2.5 text-[12px] font-medium text-[#6f5310] transition hover:bg-[#f7efcf]"
            >
              Open claims
              <QrCode size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Power size={18} />}
          label="Currently On"
          value={String(stats.currentlyOn)}
          helper={`${stats.mqttDevices} MQTT devices reporting live state`}
        />
        <MetricCard
          icon={<Activity size={18} />}
          label="Currently Off"
          value={String(stats.currentlyOff)}
          helper="Latest telemetry state marked off"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Updates 24h"
          value={String(stats.recentUpdates)}
          helper="Devices with telemetry in the last day"
        />
        <MetricCard
          icon={<Clock3 size={18} />}
          label="Stale Devices"
          value={String(stats.staleDevices)}
          helper="No live telemetry in the last 24 hours"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#161616]">State analytics</p>
              <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
                Compare live ON and OFF state updates across hourly, weekly, and monthly telemetry windows.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-[var(--iotiq-border)] bg-[#fafaf5] p-1">
              {(["hourly", "weekly", "monthly"] as Timeframe[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimeframe(option)}
                  className={`rounded-full px-3 py-2 text-[11px] font-medium capitalize transition ${
                    timeframe === option
                      ? "bg-white text-[#161616] shadow-[0_10px_18px_rgba(17,17,17,0.06)]"
                      : "text-[var(--iotiq-muted)] hover:text-[#161616]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <AnalyticsChart
              label="ON state activity"
              helper="Devices whose latest telemetry reported ON in each time bucket"
              tone="green"
              icon={<Power size={12} />}
              data={analytics.on}
            />
            <AnalyticsChart
              label="OFF state activity"
              helper="Devices whose latest telemetry reported OFF in each time bucket"
              tone="gold"
              icon={<Activity size={12} />}
              data={analytics.off}
            />
          </div>
        </article>

        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#161616]">Primary routes</p>
              <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
                Jump directly into the most-used flows.
              </p>
            </div>
            <span className="rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#155d27]">
              {loading ? "Syncing" : "Ready"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              {
                to: "/devices",
                title: "Device inventory",
                helper: "Manage onboarding, provisioning, and certificate state.",
                icon: <HardDrive size={16} />,
              },
              {
                to: "/applications",
                title: "Application console",
                helper: "Control app registrations, keys, and claim flows.",
                icon: <AppWindow size={16} />,
              },
              {
                to: "/device-control",
                title: "Device control",
                helper: "Trigger command execution from claimed devices.",
                icon: <ShieldCheck size={16} />,
              },
              {
                to: "/telemetry",
                title: "Telemetry",
                helper: "Inspect transport and device activity routes.",
                icon: <Activity size={16} />,
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4 transition hover:border-[#d9b14a] hover:bg-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef9ef] text-[#155d27]">
                  {item.icon}
                </div>
                <p className="mt-3 text-[14px] font-medium text-[#161616]">{item.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--iotiq-muted)]">{item.helper}</p>
              </Link>
            ))}
          </div>
        </article>

        <StateFeed items={recentStateUpdates} />
      </div>
    </section>
  );
}
