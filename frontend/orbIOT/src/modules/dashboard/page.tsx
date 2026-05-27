import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, AppWindow, ArrowRight, Cpu, HardDrive, QrCode, ShieldCheck } from "lucide-react";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;
type GenericRow = {
  id: string | number;
  createdAt?: string;
} & Record<string, PrimitiveValue>;

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
    const raw = String(row.createdAt ?? "").trim();
    if (!raw) return false;
    const parsed = new Date(raw);
    return !Number.isNaN(parsed.getTime()) &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getFullYear() === now.getFullYear();
  }).length;
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

export default function DashboardPage() {
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
