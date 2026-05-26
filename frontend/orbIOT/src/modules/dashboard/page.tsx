import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AppWindow,
  ArrowRight,
  Cpu,
  HardDrive,
  Network,
  QrCode,
  RadioTower,
  ShieldCheck,
  Sparkles,
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

function MetricNode({
  title,
  value,
  helper,
  icon,
  accent,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <article className="flow-card group relative overflow-hidden rounded-[28px] p-5">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6"
          style={{ boxShadow: `0 0 0 1px ${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          Live
        </span>
      </div>
      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-[36px] font-semibold tracking-[-0.06em] text-white">{value}</p>
      <p className="mt-3 text-[13px] leading-6 text-slate-300">{helper}</p>
    </article>
  );
}

function FlowOverview({
  totalDevices,
  activeDevices,
  mqttDevices,
  activeApps,
}: {
  totalDevices: number;
  activeDevices: number;
  mqttDevices: number;
  activeApps: number;
}) {
  const nodeBase =
    "relative flex flex-col gap-1 rounded-[22px] border border-white/8 bg-[#07101d]/90 px-4 py-4 shadow-[0_18px_36px_rgba(2,6,23,0.28)]";

  return (
    <article className="flow-card relative overflow-hidden rounded-[32px] p-6 md:p-7">
      <div className="absolute -left-10 top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-indigo-400/12 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles size={13} />
              System choreography
            </div>
            <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.06em] text-white md:text-[42px]">
              A modern operations graph for the full IoT estate
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-300">
              The dashboard now reads like a living route map: enrollment, control, telemetry,
              and application trust all connected in one animated surface.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/devices?devicePage&create=true"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/12 px-4 py-3 text-[13px] font-semibold text-cyan-100 transition hover:bg-cyan-300/18"
            >
              Create device
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/applications"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-white/8"
            >
              Open app claims
              <QrCode size={14} />
            </Link>
          </div>
        </div>

        <div className="flow-map rounded-[28px] border border-white/8 bg-[#040b15]/88 p-5">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_0.85fr_0.85fr]">
            <div className={`${nodeBase} flow-node flow-node--cyan`}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Inventory core</span>
              <p className="text-[27px] font-semibold tracking-[-0.05em] text-white">{totalDevices}</p>
              <p className="text-[13px] text-slate-300">Registered devices mapped into the catalog graph.</p>
            </div>
            <div className={`${nodeBase} flow-node flow-node--emerald`}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Execution lane</span>
              <p className="text-[27px] font-semibold tracking-[-0.05em] text-white">{activeDevices}</p>
              <p className="text-[13px] text-slate-300">Devices responding as active nodes in the control plane.</p>
            </div>
            <div className={`${nodeBase} flow-node flow-node--indigo`}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">MQTT mesh</span>
              <p className="text-[27px] font-semibold tracking-[-0.05em] text-white">{mqttDevices}</p>
              <p className="text-[13px] text-slate-300">Live transport branches connected to broker paths.</p>
            </div>
            <div className={`${nodeBase} flow-node flow-node--amber`}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Trusted apps</span>
              <p className="text-[27px] font-semibold tracking-[-0.05em] text-white">{activeApps}</p>
              <p className="text-[13px] text-slate-300">Application claim flows ready to enter the network.</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TrendNetwork({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number }>;
}) {
  const width = 620;
  const height = 250;
  const padding = 30;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y = height - padding - (item.value / maxValue) * (height - padding * 2);
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? width - padding} ${
    height - padding
  } L ${points[0]?.x ?? padding} ${height - padding} Z`;

  return (
    <article className="flow-card rounded-[28px] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Growth Signal</p>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">{title}</p>
          <p className="mt-2 text-[13px] text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Rolling 6 months
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8 bg-[#061120] p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full">
          {[0, 1, 2, 3].map((step) => {
            const y = padding + (step * (height - padding * 2)) / 3;
            return (
              <line
                key={step}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgba(148, 163, 184, 0.16)"
                strokeDasharray="4 10"
              />
            );
          })}
          <path d={areaPath} fill="url(#flowArea)" opacity="0.9" />
          <path
            d={linePath}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="#020617" stroke="#67e8f9" strokeWidth="3" />
              <text x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {point.label}
              </text>
            </g>
          ))}
          <defs>
            <linearGradient id="flowArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </article>
  );
}

function VendorPulse({ data }: { data: Array<[string, number]> }) {
  const total = data.reduce((sum, [, value]) => sum + value, 0) || 1;
  const palette = ["#67e8f9", "#34d399", "#818cf8", "#fbbf24"];

  return (
    <article className="flow-card rounded-[28px] p-5 md:p-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Vendor Pulse</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">Dominant network branches</p>
      <p className="mt-2 text-[13px] text-slate-300">
        The most active vendor groups currently shaping device inventory.
      </p>

      <div className="mt-5 space-y-3">
        {data.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-white/4 px-5 py-10 text-center text-[13px] text-slate-400">
            Vendor-linked devices will appear here once the inventory graph expands.
          </div>
        ) : (
          data.map(([label, value], index) => (
            <div
              key={label}
              className="rounded-[22px] border border-white/8 bg-[#061120] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]"
                    style={{ backgroundColor: palette[index % palette.length], color: palette[index % palette.length] }}
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-white">{label}</p>
                    <p className="text-[12px] text-slate-400">{Math.round((value / total) * 100)}% of current fleet</p>
                  </div>
                </div>
                <p className="text-[18px] font-semibold tracking-[-0.04em] text-white">{value}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(8, Math.round((value / total) * 100))}%`,
                    background: `linear-gradient(90deg, ${palette[index % palette.length]}, rgba(255,255,255,0.22))`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function QuickRoute({
  title,
  helper,
  to,
  icon,
  accentClass,
}: {
  title: string;
  helper: string;
  to: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <Link
      to={to}
      className={`group rounded-[24px] border border-white/8 bg-[#061120] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/14 ${accentClass}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-white">
        {icon}
      </div>
      <p className="mt-5 text-[18px] font-semibold tracking-[-0.03em] text-white">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-300">{helper}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-cyan-200">
        Open route
        <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </Link>
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
      <FlowOverview
        totalDevices={dashboard.totalDevices}
        activeDevices={dashboard.activeDevices}
        mqttDevices={dashboard.mqttDevices}
        activeApps={dashboard.activeApps}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricNode
          icon={<HardDrive size={18} />}
          title="Total devices"
          value={String(dashboard.totalDevices)}
          helper={`${dashboard.newDevicesThisMonth} devices joined this month`}
          accent="#67e8f9"
        />
        <MetricNode
          icon={<Activity size={18} />}
          title="Active fleet"
          value={String(dashboard.activeDevices)}
          helper={`${dashboard.mqttDevices} routes using MQTT transport`}
          accent="#34d399"
        />
        <MetricNode
          icon={<Cpu size={18} />}
          title="Elevate estate"
          value={String(dashboard.elevateDevices)}
          helper="IOTIQ and ELEVATE-linked fleet density"
          accent="#818cf8"
        />
        <MetricNode
          icon={<AppWindow size={18} />}
          title="Trusted apps"
          value={String(dashboard.activeApps)}
          helper={`${dashboard.totalVendors} vendors modeled in the system`}
          accent="#fbbf24"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <TrendNetwork
          title="Device graph expansion"
          subtitle={
            loading
              ? "Refreshing route density and registration signals..."
              : "Monthly registration momentum across the last six months."
          }
          data={dashboard.deviceTrend}
        />
        <VendorPulse data={dashboard.topVendors} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <article className="flow-card rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Action Routes</p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">
                Start the highest-value workflows from the control surface
              </p>
              <p className="mt-2 text-[13px] text-slate-300">
                Every route below is designed like a node in the flow graph: devices, claims, control, and telemetry.
              </p>
            </div>
            <div className="rounded-full border border-white/8 bg-white/5 px-4 py-2 text-[12px] text-slate-300">
              Click through to continue the sequence
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <QuickRoute
              title="Device onboarding"
              helper="Move directly into inventory registration and provisioning with the new animated shell."
              to="/devices?devicePage&create=true"
              icon={<Network size={18} />}
              accentClass="hover:shadow-[0_22px_42px_rgba(34,211,238,0.14)]"
            />
            <QuickRoute
              title="Application claims"
              helper="Open the app-console route to manage QR claim flows and trusted client access."
              to="/applications"
              icon={<QrCode size={18} />}
              accentClass="hover:shadow-[0_22px_42px_rgba(129,140,248,0.14)]"
            />
            <QuickRoute
              title="Remote control"
              helper="Dispatch control events and observe the command path from the route map."
              to="/device-control"
              icon={<RadioTower size={18} />}
              accentClass="hover:shadow-[0_22px_42px_rgba(52,211,153,0.14)]"
            />
            <QuickRoute
              title="Vendor security"
              helper="Adjust vendor and catalog trust boundaries before adding the next fleet segment."
              to="/devices?vendorPage"
              icon={<ShieldCheck size={18} />}
              accentClass="hover:shadow-[0_22px_42px_rgba(251,191,36,0.14)]"
            />
          </div>
        </article>

        <article className="flow-card rounded-[28px] p-5 md:p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Operator Notes</p>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">
            Why this redesign feels different
          </p>
          <div className="mt-5 space-y-3">
            {[
              "The shell now behaves like a connected control map instead of a plain admin frame.",
              "Navigation reveals active branches, route context, and ambient motion without getting noisy.",
              "Dashboard modules read as operational nodes with clear action paths into the rest of the system.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-[#061120] px-4 py-4 text-[13px] leading-6 text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
