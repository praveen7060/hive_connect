import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AppWindow,
  ArrowRight,
  Cpu,
  HardDrive,
  Plus,
  QrCode,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;
type GenericRow = {
  id: string | number;
  createdAt?: string;
  updatedAt?: string;
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
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getFullYear() === now.getFullYear()
    );
  }).length;
}

function groupRowsByRecentMonths(rows: GenericRow[], months = 6) {
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - index - 1));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      value: 0,
    };
  });

  rows.forEach((row) => {
    const raw = String(row.createdAt ?? "").trim();
    if (!raw) return;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${parsed.getMonth()}`;
    const bucket = buckets.find((entry) => entry.key === key);
    if (bucket) bucket.value += 1;
  });

  return buckets.map(({ label, value }) => ({ label, value }));
}

function DashboardMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          {icon}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Live
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-[13px] text-slate-500">{helper}</p>
    </article>
  );
}

function QuickActionCard({
  title,
  helper,
  to,
  icon,
  cta,
}: {
  title: string;
  helper: string;
  to: string;
  icon: React.ReactNode;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-[20px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.025em] text-slate-950">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-500">{helper}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-slate-700 transition group-hover:text-slate-950">
        {cta}
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}

function LineTrendChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number }>;
}) {
  const width = 560;
  const height = 240;
  const padding = 28;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x =
      padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y =
      height - padding - (item.value / maxValue) * (height - padding * 2);
    return { ...item, x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? width - padding} ${
    height - padding
  } L ${points[0]?.x ?? padding} ${height - padding} Z`;

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{title}</p>
          <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">
          6 months
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-100 bg-slate-50/80 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
          {[0, 1, 2, 3].map((step) => {
            const y = padding + (step * (height - padding * 2)) / 3;
            return (
              <line
                key={step}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 8"
              />
            );
          })}
          <path d={areaPath} fill="url(#deviceArea)" opacity="0.9" />
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
              <text
                x={point.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[11px]"
              >
                {point.label}
              </text>
            </g>
          ))}
          <defs>
            <linearGradient id="deviceArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.12" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </article>
  );
}

function VendorDistributionChart({
  data,
}: {
  data: Array<[string, number]>;
}) {
  const total = data.reduce((sum, [, value]) => sum + value, 0) || 1;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const palette = ["#2563eb", "#14b8a6", "#f97316", "#8b5cf6"];
  let offset = 0;

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Vendor mix</p>
      <p className="mt-1 text-[13px] text-slate-500">How the current fleet is distributed across top vendors.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[180px_1fr] lg:items-center">
        <div className="mx-auto">
          <svg viewBox="0 0 180 180" className="h-44 w-44">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
            {data.map(([label, value], index) => {
              const segment = (value / total) * circumference;
              const currentOffset = offset;
              offset += segment;
              return (
                <circle
                  key={label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={palette[index % palette.length]}
                  strokeWidth="18"
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                />
              );
            })}
            <text x="90" y="84" textAnchor="middle" className="fill-slate-400 text-[11px] uppercase tracking-[0.14em]">
              Vendors
            </text>
            <text x="90" y="104" textAnchor="middle" className="fill-slate-950 text-[22px] font-semibold">
              {data.length}
            </text>
          </svg>
        </div>

        <div className="space-y-3">
          {data.map(([label, value], index) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                <div>
                  <p className="text-[14px] font-medium text-slate-900">{label}</p>
                  <p className="text-[12px] text-slate-500">
                    {Math.round((value / total) * 100)}% of tracked fleet
                  </p>
                </div>
              </div>
              <p className="text-[15px] font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { rows: devices, loading: devicesLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.devices,
    { initialRows: [] }
  );
  const { rows: vendors, loading: vendorsLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.vendors,
    { initialRows: [] }
  );
  const { rows: apps, loading: appsLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.applicationConsoleApps,
    { initialRows: [] }
  );

  const loading = devicesLoading || vendorsLoading || appsLoading;

  const dashboard = useMemo(() => {
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
    const vendorsWithNames = vendors
      .map((row) => String(row.name ?? "").trim())
      .filter(Boolean);
    const deviceByVendor = new Map<string, number>();

    devices.forEach((row) => {
      const vendor =
        readCatalogVendor(row.metadata) ||
        String(row.vendorName ?? row.vendor ?? "").trim() ||
        "Unmapped";
      deviceByVendor.set(vendor, (deviceByVendor.get(vendor) ?? 0) + 1);
    });

    const topVendors = Array.from(deviceByVendor.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      totalDevices: devices.length,
      activeDevices,
      mqttDevices,
      elevateDevices,
      totalVendors: vendorsWithNames.length,
      activeApps,
      newDevicesThisMonth: formatMonthCount(devices),
      topVendors,
      deviceTrend: groupRowsByRecentMonths(devices),
    };
  }, [apps, devices, vendors]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Dashboard
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-slate-950">
            Fleet analytics
          </h1>
          <p className="mt-2 text-[13px] text-slate-500">
            {loading
              ? "Refreshing inventory analytics and operator shortcuts..."
              : "Live analytics from current device, vendor, and application records."}
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] text-slate-500 shadow-sm">
          {dashboard.activeDevices} active of {dashboard.totalDevices} registered devices
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          icon={<HardDrive size={18} />}
          label="Total devices"
          value={String(dashboard.totalDevices)}
          helper={`${dashboard.newDevicesThisMonth} added this month`}
        />
        <DashboardMetric
          icon={<Activity size={18} />}
          label="Active fleet"
          value={String(dashboard.activeDevices)}
          helper={`${dashboard.mqttDevices} using MQTT transport`}
        />
        <DashboardMetric
          icon={<Cpu size={18} />}
          label="Elevate estate"
          value={String(dashboard.elevateDevices)}
          helper="IOTIQ and ELEVATE-linked devices"
        />
        <DashboardMetric
          icon={<AppWindow size={18} />}
          label="Trusted apps"
          value={String(dashboard.activeApps)}
          helper={`${dashboard.totalVendors} vendors currently modeled`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <LineTrendChart
          title="Device growth"
          subtitle="Monthly registration trend across the last six months."
          data={dashboard.deviceTrend}
        />
        <VendorDistributionChart data={dashboard.topVendors} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Vendor actions</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Jump directly into device creation or vendor catalog work from the most active vendors.
              </p>
            </div>
            <Link
              to="/devices?vendorPage"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Open vendor management
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dashboard.topVendors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-[13px] text-slate-500">
                No vendor-linked devices yet. Add vendors and devices to unlock vendor quick actions.
              </div>
            ) : (
              dashboard.topVendors.map(([vendor, count], index) => (
                <div
                  key={vendor}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[13px] font-semibold text-slate-700 shadow-sm">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{vendor}</p>
                      <p className="text-[13px] text-slate-500">{count} devices mapped in inventory</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/devices?devicePage&create=true&vendorName=${encodeURIComponent(vendor)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                    >
                      <Plus size={13} />
                      Create device for this vendor
                    </Link>
                    <Link
                      to="/devices?itemPage"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                    >
                      <Radio size={13} />
                      View catalog items
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Quick actions</p>
          <p className="mt-1 text-[13px] text-slate-500">
            Start the most common operator flows from the dashboard.
          </p>

          <div className="mt-5 grid gap-3">
            <QuickActionCard
              icon={<Plus size={18} />}
              title="Create a new device"
              helper="Jump directly into device registration and provisioning."
              to="/devices?devicePage&create=true"
              cta="Open device form"
            />
            <QuickActionCard
              icon={<ShieldCheck size={18} />}
              title="Register a vendor"
              helper="Set up a vendor profile before mapping new catalog items and devices."
              to="/devices?vendorPage"
              cta="Open vendor workspace"
            />
            <QuickActionCard
              icon={<QrCode size={18} />}
              title="Manage enrollment apps"
              helper="Create or update applications used for QR claim and control workflows."
              to="/applications"
              cta="Open applications"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
