import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, AppWindow, ArrowRight, Cpu, HardDrive, QrCode, ShieldCheck, TrendingUp } from "lucide-react";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;
type GenericRow = {
  id: string | number;
  createdAt?: string;
} & Record<string, PrimitiveValue>;

type Timeframe = "hourly" | "weekly" | "monthly";

function getCreatedAtDate(row: GenericRow) {
  const raw = String(row.createdAt ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readCatalogVendor(value: PrimitiveValue | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = JSON.parse(value) as {
      catalog?: { vendorName?: string; vendor?: string };
    };
    return String(parsed?.catalog?.vendorName ?? parsed?.catalog?.vendor ?? "").trim();
  } catch {
    return "";
  }
}

function formatMonthCount(rows: GenericRow[]) {
  const now = new Date();
  return rows.filter((row) => {
    const parsed = getCreatedAtDate(row);
    return parsed &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getFullYear() === now.getFullYear();
  }).length;
}

function buildAnalyticsSeries(rows: GenericRow[], timeframe: Timeframe) {
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
    const parsed = getCreatedAtDate(row);
    if (!parsed) return;

    const key = formatters[timeframe](parsed);
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

function VendorList({ data }: { data: Array<[string, number]> }) {
  const total = data.reduce((sum, [, count]) => sum + count, 0) || 1;

  return (
    <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">Vendor distribution</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">Current mapped device ownership</p>
        </div>
        <span className="rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#155d27]">
          Fleet
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--iotiq-border)] px-4 py-8 text-center text-[12px] text-[var(--iotiq-muted)]">
            No vendor-linked devices yet.
          </div>
        ) : (
          data.map(([label, count]) => (
            <div key={label} className="rounded-2xl bg-[#fafaf5] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#161616]">{label}</p>
                <p className="text-[14px] font-medium text-[#161616]">{count}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ebe6d6]">
                <div
                  className="h-full rounded-full bg-[#d9b14a]"
                  style={{ width: `${Math.max(8, Math.round((count / total) * 100))}%` }}
                />
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
    const activeDevices = devices.filter(
      (row) => String(row.status ?? "").trim().toLowerCase() === "active"
    ).length;
    const mqttDevices = devices.filter(
      (row) => String(row.connectionType ?? "").trim().toUpperCase() === "MQTT"
    ).length;
    const elevateDevices = devices.filter((row) => {
      const catalogVendor = readCatalogVendor(row.metadata);
      return (
        catalogVendor.toUpperCase() === "ELEVATE" ||
        String(row.name ?? "").toUpperCase().includes("IOTIQ")
      );
    }).length;
    const activeApps = apps.filter(
      (row) => String(row.status ?? "active").trim().toLowerCase() === "active"
    ).length;
    const deviceByVendor = new Map<string, number>();

    devices.forEach((row) => {
      const vendor =
        readCatalogVendor(row.metadata) ||
        String(row.vendorName ?? row.vendor ?? "").trim() ||
        "Unmapped";
      deviceByVendor.set(vendor, (deviceByVendor.get(vendor) ?? 0) + 1);
    });

    return {
      totalDevices: devices.length,
      activeDevices,
      mqttDevices,
      elevateDevices,
      activeApps,
      vendorCount: vendors.length,
      newDevicesThisMonth: formatMonthCount(devices),
      topVendors: Array.from(deviceByVendor.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [apps, devices, vendors]);

  const analytics = useMemo(
    () => ({
      devices: buildAnalyticsSeries(devices, timeframe),
      applications: buildAnalyticsSeries(apps, timeframe),
    }),
    [apps, devices, timeframe]
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
              API-backed counts from devices, vendors, and application-console records. No placeholder copy, only current operational state.
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
          icon={<HardDrive size={18} />}
          label="Devices"
          value={String(stats.totalDevices)}
          helper={`${stats.newDevicesThisMonth} added this month`}
        />
        <MetricCard
          icon={<Activity size={18} />}
          label="Active"
          value={String(stats.activeDevices)}
          helper={`${stats.mqttDevices} on MQTT transport`}
        />
        <MetricCard
          icon={<Cpu size={18} />}
          label="ELEVATE"
          value={String(stats.elevateDevices)}
          helper="Detected from device metadata"
        />
        <MetricCard
          icon={<AppWindow size={18} />}
          label="Applications"
          value={String(stats.activeApps)}
          helper={`${stats.vendorCount} vendors mapped`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#161616]">Registration analytics</p>
              <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
                Compare device and application activity across hourly, weekly, and monthly ranges.
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
              label="Device registrations"
              helper="New inventory records over the selected range"
              tone="green"
              icon={<HardDrive size={12} />}
              data={analytics.devices}
            />
            <AnalyticsChart
              label="Application activity"
              helper="New trusted applications over the selected range"
              tone="gold"
              icon={<TrendingUp size={12} />}
              data={analytics.applications}
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

        <VendorList data={stats.topVendors} />
      </div>
    </section>
  );
}
