import { useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AppWindow,
  CheckCircle2,
  Clock3,
  Cpu,
  HardDrive,
  Package,
  Power,
  QrCode,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { RightDrawer } from "../device-inventory/components/management/ui";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;
type GenericRow = {
  id: string | number;
  createdAt?: string;
} & Record<string, PrimitiveValue>;

type Timeframe = "hourly" | "weekly" | "monthly";
type DeviceState = "on" | "off" | "unknown";
type AppRegistrationDraft = {
  name: string;
  domain: string;
  applicationCode: string;
  applicationType: string;
  clientId: string;
};
type DeviceCreationDraft = {
  itemType: string;
  itemId: string;
};

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

function inputClass() {
  return "h-11 w-full rounded-[18px] border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 text-[12.5px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]";
}

function buildPseudoQrMatrix(seed: string, size = 21) {
  const cells: boolean[] = [];
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 33 + seed.charCodeAt(index)) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;

  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const finderCorner =
        (row < 7 && col < 7) ||
        (row < 7 && col >= size - 7) ||
        (row >= size - 7 && col < 7);

      if (finderCorner) {
        const localRow = row % (size - 14);
        const localCol = col % (size - 14);
        const border = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
        const center = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
        cells.push(border || center);
        continue;
      }

      cells.push((next() & 1) === 1);
    }
  }

  return { cells, size };
}

function PseudoQr({ value }: { value: string }) {
  const { cells, size } = useMemo(() => buildPseudoQrMatrix(value || "hive-connect-app-link"), [value]);
  const cellSize = 8;
  const dimension = size * cellSize;

  return (
    <svg viewBox={`0 0 ${dimension} ${dimension}`} className="h-[188px] w-[188px] rounded-[20px] bg-white p-3">
      <rect width={dimension} height={dimension} fill="#ffffff" rx="18" />
      {cells.map((filled, index) => {
        if (!filled) return null;
        const x = (index % size) * cellSize;
        const y = Math.floor(index / size) * cellSize;
        return <rect key={index} x={x} y={y} width={cellSize} height={cellSize} rx="1.4" fill="#111111" />;
      })}
    </svg>
  );
}

function generateSerialNumber(devices: GenericRow[]) {
  const maxSerial = devices.reduce((max, device) => {
    const serial = String(device.serialNumber ?? "");
    const match = serial.match(/(\d+)$/);
    if (!match) return max;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  if (maxSerial > 0 || devices.length === 0) {
    return `HC-${String(maxSerial + 1).padStart(6, "0")}`;
  }

  const fallback =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `HC-${fallback}`;
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

function DualStateLineChart({
  onData,
  offData,
}: {
  onData: Array<{ label: string; value: number }>;
  offData: Array<{ label: string; value: number }>;
}) {
  const chartWidth = 720;
  const chartHeight = 240;
  const padding = { top: 24, right: 28, bottom: 42, left: 34 };
  const maxValue = Math.max(
    ...onData.map((entry) => entry.value),
    ...offData.map((entry) => entry.value),
    1
  );
  const onTotal = onData.reduce((sum, entry) => sum + entry.value, 0);
  const offTotal = offData.reduce((sum, entry) => sum + entry.value, 0);

  const getX = (index: number, total: number) => {
    if (total <= 1) return padding.left;
    return padding.left + (index / (total - 1)) * (chartWidth - padding.left - padding.right);
  };
  const getY = (value: number) =>
    padding.top +
    (1 - value / maxValue) * (chartHeight - padding.top - padding.bottom);

  const buildPoints = (data: Array<{ label: string; value: number }>) =>
    data.map((entry, index) => ({
      ...entry,
      x: getX(index, data.length),
      y: getY(entry.value),
    }));

  const onPoints = buildPoints(onData);
  const offPoints = buildPoints(offData);
  const buildPath = (points: Array<{ x: number; y: number }>) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const value = Math.round((maxValue / 3) * (3 - index));
    return {
      value,
      y: getY(value),
    };
  });

  return (
    <article className="mt-4 rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#161616]">ON / OFF state activity</p>
          <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
            Devices whose latest telemetry reported ON or OFF in each time bucket.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#155d27]">
            <span className="h-2 w-2 rounded-full bg-[#86bd67]" />
            ON {onTotal}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9b1c1c]">
            <span className="h-2 w-2 rounded-full bg-[#e85d5d]" />
            OFF {offTotal}
          </span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[240px] min-w-[640px] w-full"
          role="img"
          aria-label="Dual line chart comparing ON and OFF state activity"
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="18" fill="#fafaf5" />
          {gridLines.map((line) => (
            <g key={`${line.value}-${line.y}`}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={line.y}
                y2={line.y}
                stroke="#e6e7dc"
                strokeDasharray="4 6"
              />
              <text x={padding.left - 10} y={line.y + 4} textAnchor="end" className="fill-[#8b9285] text-[10px]">
                {line.value}
              </text>
            </g>
          ))}
          <path d={buildPath(offPoints)} fill="none" stroke="#e85d5d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={buildPath(onPoints)} fill="none" stroke="#86bd67" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {offPoints.map((point) => (
            <g key={`off-${point.label}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#e85d5d" stroke="#ffffff" strokeWidth="2" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-[#9b1c1c] text-[10px] font-medium">
                {point.value}
              </text>
            </g>
          ))}
          {onPoints.map((point) => (
            <g key={`on-${point.label}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#86bd67" stroke="#ffffff" strokeWidth="2" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-[#155d27] text-[10px] font-medium">
                {point.value}
              </text>
            </g>
          ))}
          {onPoints.map((point, index) => (
            <text
              key={`label-${point.label}-${index}`}
              x={point.x}
              y={chartHeight - 16}
              textAnchor="middle"
              className="fill-[var(--iotiq-muted)] text-[10px]"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("hourly");
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [appDraft, setAppDraft] = useState<AppRegistrationDraft>({
    name: "",
    domain: "",
    applicationCode: "APP",
    applicationType: "Web",
    clientId: "",
  });
  const [deviceDraft, setDeviceDraft] = useState<DeviceCreationDraft>({
    itemType: "",
    itemId: "",
  });
  const [appQr, setAppQr] = useState<{
    svg: string;
    payload: string;
    token: string;
    appName: string;
  } | null>(null);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [quickActionSuccess, setQuickActionSuccess] = useState<string | null>(null);
  const { rows: devices, loading: devicesLoading, createOne: createDeviceOne } = useCrudResource<GenericRow>(
    deviceInventoryApi.devices,
    { initialRows: [] }
  );
  const { rows: vendors, loading: vendorsLoading } = useCrudResource<GenericRow>(deviceInventoryApi.vendors, {
    initialRows: [],
  });
  const { rows: apps, loading: appsLoading, createOne: createApplicationOne } = useCrudResource<GenericRow>(
    deviceInventoryApi.applicationConsoleApps,
    { initialRows: [] }
  );
  const { rows: itemTypes, loading: itemTypesLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.itemTypes,
    { initialRows: [] }
  );
  const { rows: items, loading: itemsLoading } = useCrudResource<GenericRow>(
    deviceInventoryApi.items,
    { initialRows: [] }
  );

  const loading = devicesLoading || vendorsLoading || appsLoading || itemTypesLoading || itemsLoading;

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

  const filteredItems = useMemo(
    () =>
      deviceDraft.itemType
        ? items.filter((item) => String(item.itemType ?? "").trim() === deviceDraft.itemType)
        : items,
    [deviceDraft.itemType, items]
  );

  const closeAppDrawer = () => {
    setAppDrawerOpen(false);
    setAppQr(null);
    setQuickActionError(null);
    setQuickActionSuccess(null);
  };

  const openAppDrawer = () => {
    setAppDraft({
      name: "",
      domain: "",
      applicationCode: `APP${String(apps.length + 1).padStart(3, "0")}`,
      applicationType: "Web",
      clientId: "",
    });
    setAppQr(null);
    setQuickActionError(null);
    setQuickActionSuccess(null);
    setAppDrawerOpen(true);
  };

  const openDeviceModal = () => {
    setDeviceDraft({
      itemType: String(itemTypes[0]?.name ?? ""),
      itemId: "",
    });
    setQuickActionError(null);
    setQuickActionSuccess(null);
    setDeviceModalOpen(true);
  };

  const registerApplication = async (event: FormEvent) => {
    event.preventDefault();
    setQuickActionError(null);
    setQuickActionSuccess(null);

    try {
      const created = await createApplicationOne({
        name: appDraft.name.trim(),
        domain: appDraft.domain.trim(),
        applicationCode: appDraft.applicationCode.trim(),
        applicationType: appDraft.applicationType,
        clientId: appDraft.clientId.trim() || undefined,
        bundleVersion: "0.1",
        authType: "Bearer",
        status: "active",
      });
      const qrResponse = await deviceInventoryApi.applicationConsole.createLinkQr(created.id, {
        clientId: appDraft.clientId.trim() || undefined,
      });
      const qr = qrResponse?.qr && typeof qrResponse.qr === "object" ? (qrResponse.qr as Record<string, unknown>) : {};
      const payload = qr.payload && typeof qr.payload === "object" ? JSON.stringify(qr.payload, null, 2) : "";

      setAppQr({
        svg: typeof qr.svg === "string" ? qr.svg : "",
        payload,
        token: typeof qr.token === "string" ? qr.token : "",
        appName: String(created.name ?? appDraft.name),
      });
      setQuickActionSuccess("Application registered and link QR generated.");
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Failed to register application");
    }
  };

  const createDeviceForItem = async (event: FormEvent) => {
    event.preventDefault();
    setQuickActionError(null);
    setQuickActionSuccess(null);

    const selectedItemType = itemTypes.find((itemType) => String(itemType.name ?? "") === deviceDraft.itemType);
    const selectedItem = items.find((item) => String(item.id) === deviceDraft.itemId);
    if (!selectedItemType || !selectedItem) {
      setQuickActionError("Select both an item type and an item.");
      return;
    }

    const serialNumber = generateSerialNumber(devices);
    const itemName = String(selectedItem.name ?? "Device");
    const metadata = {
      catalog: {
        itemType: String(selectedItemType.name ?? ""),
        itemTypeId: selectedItemType.id,
        itemName,
        itemId: selectedItem.id,
        itemCode: selectedItem.itemCode ?? null,
        vendorName: selectedItem.vendor ?? selectedItem.vendorName ?? null,
        communicationPolicy: selectedItem.communicationPolicy ?? null,
      },
      quickAction: {
        source: "dashboard",
        createdAt: new Date().toISOString(),
      },
    };

    try {
      const created = await createDeviceOne({
        name: `${itemName} ${serialNumber}`,
        serialNumber,
        connectionType: "MQTT",
        project: "HIVE_CONNECT",
        status: "provisioning",
        metadata: JSON.stringify(metadata, null, 2),
      });
      setQuickActionSuccess(`Created ${created.name ?? serialNumber}.`);
      setDeviceModalOpen(false);
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Failed to create device");
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.38fr]">
        <div className="grid gap-3 sm:grid-cols-2">
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

        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
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

          <DualStateLineChart onData={analytics.on} offData={analytics.off} />
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">

        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#161616]">Quick Actions</p>
              <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
                Register apps, generate QR sessions, and seed devices without leaving the dashboard.
              </p>
            </div>
            <span className="rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#155d27]">
              {loading ? "Syncing" : "Ready"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              {
                title: "Register your application",
                helper: "Create an application profile and generate a fresh link QR.",
                icon: <AppWindow size={16} />,
                action: openAppDrawer,
              },
              {
                title: "Create device for item type",
                helper: "Select an item type and item, then assign the next serial number.",
                icon: <Package size={16} />,
                action: openDeviceModal,
              },
              {
                title: "Device control",
                helper: "Run commands from claimed devices.",
                icon: <ShieldCheck size={16} />,
                action: () => {
                  window.location.href = "/device-control";
                },
              },
              {
                title: "Telemetry",
                helper: "Inspect transport and device activity.",
                icon: <Activity size={16} />,
                action: () => {
                  window.location.href = "/telemetry";
                },
              },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4 text-left transition hover:border-[#d9b14a] hover:bg-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef9ef] text-[#155d27]">
                  {item.icon}
                </div>
                <p className="mt-3 text-[14px] font-medium text-[#161616]">{item.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--iotiq-muted)]">{item.helper}</p>
              </button>
            ))}
          </div>
          {quickActionSuccess ? (
            <p className="mt-3 rounded-[16px] border border-[#dcebd6] bg-[#f6fbf2] px-3 py-2 text-[12px] text-[#51753d]">
              {quickActionSuccess}
            </p>
          ) : null}
        </article>

        <StateFeed items={recentStateUpdates} />
      </div>

      <RightDrawer open={appDrawerOpen} onClose={closeAppDrawer} size="compact">
        <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fcfcf8_0%,#f7f8f2_100%)]">
          <div className="border-b border-[var(--iotiq-border)] bg-white/90 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">Quick Action</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-[#161616]">
                  Register Application
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[var(--iotiq-muted)]">
                  Create a trusted app and generate a fresh QR for account linking.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAppDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[#161616] transition hover:bg-white"
                aria-label="Close application drawer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <form className="space-y-4" onSubmit={registerApplication}>
              <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
                <div className="grid gap-4">
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-[#161616]">Application Name</span>
                    <input
                      value={appDraft.name}
                      onChange={(event) => setAppDraft((current) => ({ ...current, name: event.target.value }))}
                      className={inputClass()}
                      placeholder="Hive mobile app"
                      required
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-[#161616]">Domain</span>
                    <input
                      value={appDraft.domain}
                      onChange={(event) => setAppDraft((current) => ({ ...current, domain: event.target.value }))}
                      className={inputClass()}
                      placeholder="app.hiveconnect.local"
                      required
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[12px] font-medium text-[#161616]">Code</span>
                      <input
                        value={appDraft.applicationCode}
                        onChange={(event) =>
                          setAppDraft((current) => ({ ...current, applicationCode: event.target.value }))
                        }
                        className={inputClass()}
                        required
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[12px] font-medium text-[#161616]">Type</span>
                      <select
                        value={appDraft.applicationType}
                        onChange={(event) =>
                          setAppDraft((current) => ({ ...current, applicationType: event.target.value }))
                        }
                        className={inputClass()}
                      >
                        <option value="Web">Web</option>
                        <option value="Mobile">Mobile</option>
                        <option value="Desktop">Desktop</option>
                      </select>
                    </label>
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-[#161616]">Client ID</span>
                    <input
                      value={appDraft.clientId}
                      onChange={(event) => setAppDraft((current) => ({ ...current, clientId: event.target.value }))}
                      className={inputClass()}
                      placeholder="Optional client identifier"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-4 py-3 text-[12px] font-medium text-white transition hover:bg-[#222222]"
              >
                <QrCode size={14} />
                Register and Generate QR
              </button>
            </form>

            {quickActionError ? (
              <p className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                {quickActionError}
              </p>
            ) : null}

            {appQr ? (
              <div className="mt-4 rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
                <div className="flex items-center gap-2 text-[#155d27]">
                  <CheckCircle2 size={15} />
                  <p className="text-[12px] font-medium">New QR ready for {appQr.appName}</p>
                </div>
                <div className="mt-4 flex flex-col items-center gap-3 rounded-[20px] bg-[#fafaf5] px-4 py-5">
                  {appQr.svg ? (
                    <div
                      className="flex h-[188px] w-[188px] items-center justify-center overflow-hidden rounded-[20px] bg-white p-3"
                      dangerouslySetInnerHTML={{ __html: appQr.svg }}
                    />
                  ) : (
                    <PseudoQr value={appQr.payload || appQr.token} />
                  )}
                  <p className="max-w-xs text-center text-[11px] leading-5 text-[var(--iotiq-muted)]">
                    Scan this QR from the registered application to start account linking.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </RightDrawer>

      {deviceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/18 px-4 backdrop-blur-[3px]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setDeviceModalOpen(false)}
            aria-label="Close create device modal"
          />
          <form
            onSubmit={createDeviceForItem}
            className="relative w-full max-w-[560px] rounded-[24px] border border-[var(--iotiq-border)] bg-white p-5 shadow-[0_32px_90px_rgba(17,17,17,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">Quick Action</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-[#161616]">
                  Create Device
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[var(--iotiq-muted)]">
                  Select an item type and item. The next serial number is assigned automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeviceModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[#161616] transition hover:bg-white"
                aria-label="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-[12px] font-medium text-[#161616]">Item Type</span>
                <select
                  value={deviceDraft.itemType}
                  onChange={(event) =>
                    setDeviceDraft({
                      itemType: event.target.value,
                      itemId: "",
                    })
                  }
                  className={inputClass()}
                  required
                >
                  <option value="">Select item type</option>
                  {itemTypes.map((itemType) => (
                    <option key={itemType.id} value={String(itemType.name ?? "")}>
                      {String(itemType.name ?? "Untitled item type")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[12px] font-medium text-[#161616]">Item</span>
                <select
                  value={deviceDraft.itemId}
                  onChange={(event) => setDeviceDraft((current) => ({ ...current, itemId: event.target.value }))}
                  className={inputClass()}
                  required
                >
                  <option value="">Select item</option>
                  {filteredItems.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {String(item.name ?? item.itemCode ?? "Untitled item")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9ef] text-[#155d27]">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[#161616]">{generateSerialNumber(devices)}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--iotiq-muted)]">Next serial number</p>
                  </div>
                </div>
              </div>
            </div>

            {quickActionError ? (
              <p className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                {quickActionError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeviceModalOpen(false)}
                className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-2.5 text-[12px] font-medium text-[#161616] transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#222222]"
              >
                <HardDrive size={14} />
                Create Device
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
