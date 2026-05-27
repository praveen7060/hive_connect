import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wifi,
  Zap,
} from "lucide-react";
import {
  deviceInventoryApi,
  type CatalogCommandDefinition,
  type CatalogProfileResponse,
} from "../../api";

type PrimitiveValue = string | number | boolean | null;

interface DeviceDetailsViewProps {
  device: Record<string, PrimitiveValue>;
  onBack: () => void;
  onEdit: () => void;
}

type DetailTab =
  | "Overview"
  | "Control"
  | "Connectivity"
  | "Certificates"
  | "Logs"
  | "OTA"
  | "Monitoring";

type DeviceRecord = Record<string, PrimitiveValue>;

interface IotDocuments {
  certificate?: string | null;
  privateKey?: string | null;
  publicKey?: string | null;
  metadata?: string | null;
}

interface ClaimQrState {
  svg: string;
  deepLink: string;
  expiresAt?: string;
  token?: string;
}

type CommandDraft = {
  parameters: Record<string, string>;
  payloadJson: string;
};

const TABS: Array<{
  id: DetailTab;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "Overview", label: "Overview", icon: Activity },
  { id: "Control", label: "Control", icon: Zap },
  { id: "Connectivity", label: "Connectivity", icon: Wifi },
  { id: "Certificates", label: "Certificates", icon: ShieldCheck },
  { id: "Logs", label: "Logs", icon: FileText },
  { id: "OTA", label: "OTA", icon: Upload },
  { id: "Monitoring", label: "Monitoring", icon: Radio },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: PrimitiveValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function displayText(value: PrimitiveValue | undefined, fallback = "Not available") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function formatDateTime(value: unknown, fallback = "Pending") {
  const raw = readString(value);
  if (!raw) return fallback;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value: unknown, fallback = "No recent sync") {
  const raw = readString(value);
  if (!raw) return fallback;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function maskValue(value: string | undefined, lead = 8, tail = 6) {
  if (!value) return "Protected credential";
  if (value.length <= lead + tail) return "Protected credential";
  return `${value.slice(0, lead)}••••${value.slice(-tail)}`;
}

function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return Promise.reject(new Error("Clipboard unavailable"));
  return navigator.clipboard.writeText(value);
}

function downloadFile(fileName: string, content: string, contentType: string) {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function metricTone(level: "good" | "warn" | "neutral") {
  if (level === "good") return "border-[#dcebd6] bg-[#f6fbf2] text-[#51753d]";
  if (level === "warn") return "border-[#ead8aa] bg-[#fff9ea] text-[#8a6511]";
  return "border-[var(--iotiq-border)] bg-[#fafaf5] text-[var(--iotiq-muted)]";
}

function humanizeCommandKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function commandLabel(command: CatalogCommandDefinition) {
  return command.name?.trim() || humanizeCommandKey(command.key);
}

function collectParameterKeys(payloadTemplate: Record<string, unknown> | undefined) {
  const keys = new Set<string>();

  function walk(value: unknown) {
    if (typeof value === "string") {
      const matches = value.matchAll(/\{\{params\.([a-zA-Z0-9_]+)\}\}/g);
      for (const match of matches) {
        if (match[1]) keys.add(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  }

  walk(payloadTemplate);
  return Array.from(keys);
}

function createCommandDraft(command: CatalogCommandDefinition): CommandDraft {
  const parameterKeys = collectParameterKeys(command.payloadTemplate);
  return {
    parameters: Object.fromEntries(parameterKeys.map((key) => [key, ""])),
    payloadJson: JSON.stringify(command.payloadTemplate ?? {}, null, 2),
  };
}

function parsePayloadJson(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  return isRecord(parsed) ? parsed : {};
}

function findMissingCommandParameters(
  command: CatalogCommandDefinition,
  parameters: Record<string, string>
) {
  return collectParameterKeys(command.payloadTemplate).filter((key) => !parameters[key]?.trim());
}

function hasUnresolvedParameterTokens(value: string) {
  return /\{\{params\.[a-zA-Z0-9_]+\}\}/.test(value);
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof RefreshCw;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3.5 text-[12px] font-medium text-[var(--iotiq-text)] transition hover:border-[#d9dfcb] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SmallStat({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] text-[var(--iotiq-muted)]">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">{value}</p>
      <p className="mt-1 text-[11px] text-[#8b9084]">{meta}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.03em] text-[var(--iotiq-text)]">{title}</h3>
          {subtitle ? <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DeviceDetailsView({ device, onBack, onEdit }: DeviceDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [liveDevice, setLiveDevice] = useState<DeviceRecord | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState<Record<string, unknown> | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [claimQr, setClaimQr] = useState<ClaimQrState | null>(null);
  const [claimQrLoading, setClaimQrLoading] = useState(false);
  const [claimQrError, setClaimQrError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<IotDocuments | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [credentialsUnlocked, setCredentialsUnlocked] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [catalogProfile, setCatalogProfile] = useState<CatalogProfileResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [commandDrafts, setCommandDrafts] = useState<Record<string, CommandDraft>>({});
  const [expandedPayloadTemplates, setExpandedPayloadTemplates] = useState<Record<string, boolean>>({});
  const autoQrRequestRef = useRef<string | null>(null);

  const deviceRecord = liveDevice ?? device;
  const deviceId = displayText(deviceRecord.id, "");
  const deviceName = displayText(deviceRecord.name, "Unnamed device");
  const serialNumber = displayText(deviceRecord.serialNumber, "Unknown serial");
  const connectionType = displayText(deviceRecord.connectionType, "MQTT").toUpperCase();
  const status = displayText(deviceRecord.status, "active").toLowerCase();

  const metadata = useMemo(() => parseMetadata(deviceRecord.metadata), [deviceRecord.metadata]);
  const iot = useMemo(() => getRecord(metadata, "iot"), [metadata]);
  const catalog = useMemo(() => getRecord(metadata, "catalog"), [metadata]);
  const onboarding = useMemo(() => getRecord(metadata, "onboarding"), [metadata]);
  const onboardingQr = useMemo(() => getRecord(onboarding, "qr"), [onboarding]);

  const thingId =
    readString(iot.thingId) ??
    readString(iot.thingName) ??
    displayText(deviceRecord.foreignId, "Pending thing");
  const connectAdminDeviceId = readString(iot.deviceId) ?? serialNumber;
  const lastSyncAt =
    readString(iot.updatedAt) ??
    readString(onboarding.generatedAt) ??
    displayText(deviceRecord.updatedAt, "");
  const onboardingVersion =
    readNumber(onboarding.onboardingVersion) ??
    readNumber(deviceRecord.onboardingVersion) ??
    0;
  const firmwareVersion = readString(iot.firmwareVersion) ?? "Not reported";
  const thingType = readString(iot.thingTypeName) ?? readString(catalog.itemType) ?? "vendor.elevate.device";
  const secureBucket = readString(onboardingQr.bucket) ?? readString(iot.bucket) ?? "Protected bucket";
  const secureObjectKey = readString(onboardingQr.objectKey);
  const onboardingQrSvg = readString(onboardingQr.svg) ?? readString(onboarding.qrSvg);
  const qrGeneratedAt = readString(onboarding.generatedAt) ?? displayText(deviceRecord.lastQrGeneratedAt, "");
  const vendorName = readString(catalog.vendorName) ?? "Vendor not mapped";
  const policyName = readString(iot.policyAttached) ?? readString(getRecord(catalog, "provisioning").policyName) ?? "Default device policy";
  const certificatePaths = {
    certificate: readString(getRecord(iot, "documents").certificate),
    privateKey: readString(getRecord(iot, "documents").privateKey),
    publicKey: readString(getRecord(iot, "documents").publicKey),
    metadata: readString(getRecord(iot, "documents").metadata),
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!deviceId) return;

      setDetailsLoading(true);
      try {
        const [deviceResult, provisioningResult, profileResult] = await Promise.allSettled([
          deviceInventoryApi.devices.getById(deviceId),
          deviceInventoryApi.iot.getProvisioningStatus(serialNumber),
          deviceInventoryApi.iot.getCatalogProfile(deviceId),
        ]);

        if (cancelled) return;

        if (deviceResult.status === "fulfilled") {
          setLiveDevice(deviceResult.value as DeviceRecord);
          setProvisioningError(null);
        } else {
          const message =
            deviceResult.reason instanceof Error
              ? deviceResult.reason.message
              : "Unable to load live device state";
          setProvisioningError(message);
        }

        if (provisioningResult.status === "fulfilled") {
          setProvisioningStatus(isRecord(provisioningResult.value) ? provisioningResult.value : null);
        } else {
          setProvisioningStatus(null);
        }

        if (profileResult.status === "fulfilled") {
          setCatalogProfile(profileResult.value);
          setCommandDrafts(
            Object.fromEntries(
              (profileResult.value.commands ?? []).map((command) => [command.key, createCommandDraft(command)])
            )
          );
          setCatalogError(null);
        } else {
          const message =
            profileResult.reason instanceof Error
              ? profileResult.reason.message
              : "Unable to load command profile";
          setCatalogProfile(null);
          setCatalogError(message);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load live device state";
          setProvisioningError(message);
          setCatalogError(message);
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [deviceId, serialNumber]);

  const certificateId =
    readString(provisioningStatus?.provisioning && (provisioningStatus.provisioning as Record<string, unknown>).certificateId) ??
    readString(iot.certificateId);
  const certificateArn =
    readString(provisioningStatus?.provisioning && (provisioningStatus.provisioning as Record<string, unknown>).certificateArn) ??
    readString(iot.certificateArn);
  const secureRegion =
    readString(provisioningStatus?.provisioning && (provisioningStatus.provisioning as Record<string, unknown>).region) ??
    readString(onboardingQr.region) ??
    "ap-south-1";
  const secureState = certificateId ? "Secure" : "Provisioning";
  const policyCommands = catalogProfile?.commands ?? [];

  const signalQuality = useMemo(() => {
    const updated = new Date(lastSyncAt);
    if (Number.isNaN(updated.getTime())) return "Medium";

    const ageMinutes = Math.floor((Date.now() - updated.getTime()) / 60000);
    if (ageMinutes <= 5) return "High";
    if (ageMinutes <= 20) return "Medium";
    return "Low";
  }, [lastSyncAt]);

  const overviewInsights = useMemo(() => {
    if (status !== "active") {
      return {
        tone: "warn" as const,
        title: "Attention recommended",
        body: "Device is not reporting an active lifecycle state. Review connectivity and last command execution.",
      };
    }

    if (!certificateId) {
      return {
        tone: "warn" as const,
        title: "Provisioning still completing",
        body: "Connectivity exists, but certificate visibility is still protected until the secure asset sync is confirmed.",
      };
    }

    return {
      tone: "good" as const,
      title: "No anomalies detected",
      body: "Heartbeat, secure storage linkage, and onboarding assets look stable from the latest sync snapshot.",
    };
  }, [certificateId, status]);

  const timeline = useMemo(
    () => [
      {
        label: "Device record updated",
        time: formatDateTime(deviceRecord.updatedAt),
        note: "Inventory snapshot refreshed",
      },
      {
        label: "Provisioning synced",
        time: formatDateTime(deviceRecord.lastProvisionedAt),
        note: certificateId ? "Certificate references linked" : "Awaiting certificate confirmation",
      },
      {
        label: "QR asset generated",
        time: formatDateTime(qrGeneratedAt, "QR not generated yet"),
        note: secureObjectKey ? "Onboarding QR stored in secure asset bucket" : "QR asset path pending",
      },
      {
        label: "Record created",
        time: formatDateTime(deviceRecord.createdAt),
        note: "Initial inventory registration",
      },
    ],
    [certificateId, deviceRecord.createdAt, deviceRecord.lastProvisionedAt, deviceRecord.updatedAt, qrGeneratedAt, secureObjectKey]
  );

  const handleGenerateClaimQr = useCallback(async (regenerate = false) => {
    if (!deviceId) return;

    setClaimQrLoading(true);
    setClaimQrError(null);
    try {
      const response = await deviceInventoryApi.applicationConsole.createEnrollmentQr(deviceId, {
        qrType: regenerate ? "device_claim_regenerated" : "device_claim",
      });

      const qr = isRecord(response?.qr) ? response.qr : {};
      const payload = isRecord(qr.payload) ? qr.payload : {};
      const nextState: ClaimQrState = {
        svg: readString(qr.svg) ?? "",
        deepLink: readString(qr.deepLink) ?? "",
        expiresAt: readString(payload.expiresAt),
        token: readString(qr.token),
      };
      setClaimQr(nextState);
      setActionFeedback(regenerate ? "Claim QR regenerated" : "Claim QR generated");
    } catch (error) {
      setClaimQrError(error instanceof Error ? error.message : "Unable to generate claim QR");
    } finally {
      setClaimQrLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || claimQrLoading || claimQr?.svg || onboardingQrSvg) return;
    if (autoQrRequestRef.current === deviceId) return;

    autoQrRequestRef.current = deviceId;
    void handleGenerateClaimQr(false);
  }, [claimQr?.svg, claimQrLoading, deviceId, handleGenerateClaimQr, onboardingQrSvg]);

  const handleRevealCredentials = async () => {
    const validation = typeof window !== "undefined"
      ? window.prompt("Enter the device serial number to reveal protected credentials.")
      : null;

    if (!validation || validation.trim() !== serialNumber) {
      setDocumentsError("Session validation failed. Use the device serial number to unlock protected assets.");
      return;
    }

    setCredentialsUnlocked(true);
    setDocumentsError(null);

    if (documents || documentsLoading) return;

    setDocumentsLoading(true);
    try {
      const response = await deviceInventoryApi.iot.getDeviceDocuments(connectAdminDeviceId, {
        thingName: thingId,
        documentPaths: certificatePaths,
      });
      setDocuments(response.documents);
    } catch (error) {
      setDocumentsError(error instanceof Error ? error.message : "Unable to fetch protected certificate assets");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const runControlAction = async (actionKey: string) => {
    setActionBusy(actionKey);
    setActionFeedback(null);

    try {
      if (actionKey === "shadow") {
        await deviceInventoryApi.iot.publishToDevice(connectAdminDeviceId, {
          subTopic: `$aws/things/${thingId}/shadow/get`,
          payload: { requestedBy: "orbIOT", deviceId: connectAdminDeviceId },
        });
        setActionFeedback("Shadow refresh requested");
      } else {
        const statusMap: Record<string, string> = {
          restart: "restart",
          sync: "sync",
          reconnect: "reconnect",
          ota: "ota_check",
        };
        await deviceInventoryApi.iot.controlDevice(connectAdminDeviceId, {
          status: statusMap[actionKey] ?? actionKey,
        });
        setActionFeedback(
          actionKey === "restart"
            ? "Restart command queued"
            : actionKey === "sync"
              ? "State sync requested"
              : actionKey === "reconnect"
                ? "Reconnect command sent"
                : "OTA check initiated"
        );
      }
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Command execution failed");
    } finally {
      setActionBusy(null);
    }
  };

  const updateCommandParameter = (commandKey: string, parameterKey: string, value: string) => {
    setCommandDrafts((current) => ({
      ...current,
      [commandKey]: {
        ...(current[commandKey] ?? { parameters: {}, payloadJson: "{}" }),
        parameters: {
          ...(current[commandKey]?.parameters ?? {}),
          [parameterKey]: value,
        },
      },
    }));
  };

  const updateCommandPayload = (commandKey: string, value: string) => {
    setCommandDrafts((current) => ({
      ...current,
      [commandKey]: {
        ...(current[commandKey] ?? { parameters: {}, payloadJson: "{}" }),
        payloadJson: value,
      },
    }));
  };

  const executePolicyCommand = async (command: CatalogCommandDefinition) => {
    const draft = commandDrafts[command.key] ?? createCommandDraft(command);
    setActionFeedback(null);

    try {
      const missingParameters = findMissingCommandParameters(command, draft.parameters);
      if (missingParameters.length > 0) {
        setActionFeedback(`Enter ${missingParameters.join(", ")} before sending ${commandLabel(command)}.`);
        return;
      }

      if (hasUnresolvedParameterTokens(draft.payloadJson)) {
        setActionFeedback("Payload JSON still contains unresolved {{params.*}} placeholders.");
        return;
      }

      setActionBusy(`policy:${command.key}`);
      const payload = parsePayloadJson(draft.payloadJson);
      await deviceInventoryApi.iot.executeCatalogCommand(deviceId, command.key, {
        messageId: command.messageId,
        parameters: draft.parameters,
        payload,
        topic: command.topicTemplate ?? undefined,
        subTopic: command.subTopic ?? undefined,
      });
      setActionFeedback(`${commandLabel(command)} command queued from messaging policy`);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Command execution failed");
    } finally {
      setActionBusy(null);
    }
  };

  const headerStatus = status === "active" ? "Online" : status === "provisioning" ? "Provisioning" : "Offline";
  const monitoringLabel = detailsLoading ? "Refreshing live state" : formatRelative(lastSyncAt);
  const onboardingQrReady = Boolean(secureObjectKey || onboardingQrSvg);
  const visibleQrSvg = claimQr?.svg || onboardingQrSvg;

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fcfcf8_0%,#f7f8f2_100%)] text-[var(--iotiq-text)]">
      <div className="border-b border-[var(--iotiq-border)] bg-white/88 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[var(--iotiq-muted)]">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-2.5 py-1 text-[11px] transition hover:bg-white"
              >
                <ChevronRight size={12} className="rotate-180" />
                Devices
              </button>
              <span>{serialNumber}</span>
            </div>
            <h2 className="mt-3 truncate text-[26px] font-semibold tracking-[-0.06em] text-[var(--iotiq-text)]">
              {deviceName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--iotiq-muted)]">
              <span>{vendorName}</span>
              <span className="text-[#d1d5cb]">•</span>
              <span>{thingType}</span>
              <span className="text-[#d1d5cb]">•</span>
              <span>{monitoringLabel}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap justify-end gap-2">
              {([
                { label: headerStatus, tone: status === "active" ? "good" : status === "provisioning" ? "warn" : "neutral" },
                { label: connectionType, tone: "neutral" as const },
                { label: secureState, tone: certificateId ? "good" : "warn" },
              ] as Array<{ label: string; tone: "good" | "warn" | "neutral" }>).map((pill) => (
                <span
                  key={pill.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${metricTone(pill.tone)}`}
                >
                  <span className={`inventory-pulse-dot ${pill.tone === "good" ? "bg-[#7caf63]" : pill.tone === "warn" ? "bg-[#d9b14a]" : "bg-[#b6bbaf]"}`} />
                  {pill.label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ActionButton icon={Pencil} label="Edit" onClick={onEdit} />
              <ActionButton icon={Power} label="Restart" onClick={() => void runControlAction("restart")} disabled={actionBusy !== null} />
              <ActionButton icon={RefreshCw} label="Sync" onClick={() => void runControlAction("sync")} disabled={actionBusy !== null} />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[var(--iotiq-text)] transition hover:bg-white"
                aria-label="More actions"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-[var(--iotiq-border)] bg-white/84 px-4 py-3 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                activeTab === id
                  ? "border-[#d7e7d0] bg-[rgba(124,175,99,0.12)] text-[#426230] shadow-[0_8px_20px_rgba(124,175,99,0.08)]"
                  : "border-transparent bg-[#f7f8f2] text-[var(--iotiq-muted)] hover:border-[var(--iotiq-border)] hover:bg-white"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4 pb-5">
          {actionFeedback ? (
            <div className="rounded-[18px] border border-[#e7eadf] bg-white px-4 py-3 text-[12px] text-[var(--iotiq-muted)] shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              {actionFeedback}
            </div>
          ) : null}

          {activeTab === "Overview" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <SmallStat label="Thing ID" value={thingId} meta="Secure runtime identity" />
                <SmallStat label="Firmware" value={firmwareVersion} meta="Latest reported build" />
                <SmallStat label="Signal quality" value={signalQuality} meta={monitoringLabel} />
                <SmallStat label="Onboarding" value={String(onboardingVersion || 1)} meta="Asset version" />
              </div>

              <div className="grid gap-4">
                <SectionCard
                  title="Pairing and claim"
                  subtitle="Primary QR actions for pairing, field claims, and operator handoff."
                  action={
                    <button
                      type="button"
                      onClick={() => void handleGenerateClaimQr(false)}
                      disabled={claimQrLoading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[11px] font-medium text-[var(--iotiq-text)] transition hover:bg-white disabled:opacity-45"
                    >
                      <QrCode size={13} />
                      {claimQrLoading ? "Generating" : "Generate"}
                    </button>
                  }
                >
                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="rounded-[22px] border border-[#e6ebdb] bg-[linear-gradient(180deg,#ffffff_0%,#f7f9f2_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <div className="flex h-[196px] items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-[#d8dfca] bg-white">
                        {visibleQrSvg ? (
                          <div
                            className="[&_svg]:h-[170px] [&_svg]:w-[170px]"
                            dangerouslySetInnerHTML={{ __html: visibleQrSvg }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center text-[var(--iotiq-muted)]">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f7ee] text-[#7caf63]">
                              <QrCode size={28} />
                            </div>
                            <p className="text-[12px] font-medium text-[var(--iotiq-text)]">{claimQrLoading ? "Generating secure QR" : "Generate secure QR"}</p>
                            <p className="max-w-[150px] text-[11px] leading-5">
                              {claimQrLoading
                                ? "Preparing QR for secure device pairing and claim."
                                : "Generate a claim QR to start controlled device sharing."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Active QR workflow</p>
                            <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                              Secure asset storage is linked to onboarding records and claim flows.
                            </p>
                          </div>
                          <ShieldCheck size={16} className="text-[#7caf63]" />
                        </div>
                        <div className="mt-3 grid gap-2 text-[11px] text-[var(--iotiq-muted)]">
                          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                            <span>Onboarding asset</span>
                            <span className="font-medium text-[var(--iotiq-text)]">{onboardingQrReady ? "Stored" : "Pending"}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                            <span>Bucket</span>
                            <span className="font-medium text-[var(--iotiq-text)]">{secureBucket}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                            <span>Generated</span>
                            <span className="font-medium text-[var(--iotiq-text)]">{formatDateTime(qrGeneratedAt, "Pending")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          icon={Download}
                          label="Download QR"
                          onClick={() => visibleQrSvg && downloadFile(`${serialNumber}-claim-qr.svg`, visibleQrSvg, "image/svg+xml")}
                          disabled={!visibleQrSvg}
                        />
                        <ActionButton
                          icon={RefreshCw}
                          label="Regenerate QR"
                          onClick={() => void handleGenerateClaimQr(true)}
                          disabled={claimQrLoading}
                        />
                        <ActionButton
                          icon={Copy}
                          label="Copy claim link"
                          onClick={() => claimQr?.deepLink && void copyText(claimQr.deepLink)}
                          disabled={!claimQr?.deepLink}
                        />
                      </div>

                      {claimQr?.expiresAt ? (
                        <p className="text-[11px] text-[var(--iotiq-muted)]">Claim QR expires {formatDateTime(claimQr.expiresAt)}</p>
                      ) : null}
                      {claimQrError ? <p className="text-[11px] text-[#a55a4d]">{claimQrError}</p> : null}
                    </div>
                  </div>
                </SectionCard>

              </div>

              <div className="grid gap-4">
                <SectionCard title="Device summary" subtitle="Clean runtime context without dumping the full metadata payload.">
                  <div className="grid gap-2 text-[12px]">
                    {[
                      ["Project", displayText(deviceRecord.project, "No project")],
                      ["Connection", connectionType],
                      ["Policy", policyName],
                      ["Thing type", thingType],
                      ["Region", secureRegion],
                      ["Status", headerStatus],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-2xl bg-[#fafaf5] px-3 py-2.5">
                        <span className="text-[var(--iotiq-muted)]">{label}</span>
                        <span className="max-w-[55%] truncate font-medium text-[var(--iotiq-text)]">{value}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </>
          ) : null}

          {activeTab === "Control" ? (
            <div className="grid gap-4">
              <SectionCard
                title="Messaging policy commands"
                subtitle="These actions are resolved from the device communication policy and MQTT message topics."
                action={
                  <div className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-1 text-[11px] text-[var(--iotiq-muted)]">
                    {policyCommands.length} command{policyCommands.length === 1 ? "" : "s"}
                  </div>
                }
              >
                {policyCommands.length ? (
                  <div className="grid gap-3">
                    {policyCommands.map((command) => {
                      const draft = commandDrafts[command.key] ?? createCommandDraft(command);
                      const parameterKeys = Object.keys(draft.parameters);
                      const busy = actionBusy === `policy:${command.key}`;
                      const payloadExpanded = Boolean(expandedPayloadTemplates[command.key]);

                      return (
                        <div
                          key={command.key}
                          className="rounded-[22px] border border-[var(--iotiq-border)] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-medium text-[var(--iotiq-text)]">{commandLabel(command)}</p>
                                {command.policyType ? (
                                  <span className="rounded-full bg-[#f6f7f1] px-2 py-0.5 text-[10px] text-[#7a816f]">
                                    {command.policyType}
                                  </span>
                                ) : null}
                                {command.communicationMethod ? (
                                  <span className="rounded-full bg-[#edf6e8] px-2 py-0.5 text-[10px] text-[#69954d]">
                                    {command.communicationMethod}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] leading-5 text-[var(--iotiq-muted)]">
                                Topic: {command.topicTemplate ?? command.subTopic ?? "Resolved by adapter"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPayloadTemplates((current) => ({
                                    ...current,
                                    [command.key]: !current[command.key],
                                  }))
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[11px] font-medium text-[var(--iotiq-muted)] transition hover:bg-white"
                                aria-expanded={payloadExpanded}
                                aria-label={payloadExpanded ? "Hide payload template" : "Show payload template"}
                              >
                                Payload
                                <ChevronDown size={13} className={`transition ${payloadExpanded ? "rotate-180" : ""}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void executePolicyCommand(command)}
                                disabled={busy}
                                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#111111] px-4 text-[12px] font-medium text-white transition hover:bg-[#1f1f1f] disabled:opacity-50"
                              >
                                <Play size={13} />
                                {busy ? "Running..." : "Run"}
                              </button>
                            </div>
                          </div>

                          {parameterKeys.length ? (
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              {parameterKeys.map((parameterKey) => (
                                <label key={parameterKey} className="space-y-1.5">
                                  <span className="text-[11px] text-[var(--iotiq-muted)]">{parameterKey}</span>
                                  <input
                                    value={draft.parameters[parameterKey] ?? ""}
                                    onChange={(event) =>
                                      updateCommandParameter(command.key, parameterKey, event.target.value)
                                    }
                                    className="h-10 w-full rounded-2xl border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[12px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]"
                                    placeholder={`Set ${parameterKey}`}
                                  />
                                </label>
                              ))}
                            </div>
                          ) : null}

                          {payloadExpanded ? (
                            <div className="mt-4 space-y-1.5">
                              <p className="text-[11px] text-[var(--iotiq-muted)]">Payload template</p>
                              <textarea
                                value={draft.payloadJson}
                                onChange={(event) => updateCommandPayload(command.key, event.target.value)}
                                rows={6}
                                className="w-full rounded-[20px] border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 py-3 font-mono text-[11px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]"
                                spellCheck={false}
                              />
                              <p className="text-[10px] text-[#8d9187]">
                                Values here map directly to the messaging policy payload template and MQTT topic execution.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4 text-[12px] text-[var(--iotiq-muted)]">
                    {catalogError
                      ? `Unable to resolve commands from messaging policies: ${catalogError}`
                      : "No command definitions were resolved for this device communication policy yet."}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Operational actions" subtitle="High-confidence actions mapped to live IoT orchestration endpoints.">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { key: "restart", title: "Restart device", body: "Send a restart control command to the connected runtime.", icon: Power },
                    { key: "sync", title: "Sync state", body: "Request a fresh state sync from the device service.", icon: RefreshCw },
                    { key: "shadow", title: "Refresh shadow", body: "Trigger an AWS IoT shadow fetch for current cloud-side state.", icon: Activity },
                    { key: "reconnect", title: "Reconnect MQTT", body: "Ask the device transport to rebuild its secure MQTT link.", icon: Wifi },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => void runControlAction(action.key)}
                        disabled={actionBusy !== null}
                        className="group rounded-[22px] border border-[var(--iotiq-border)] bg-white p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#d5e4cf] hover:bg-[#fcfcf8] disabled:opacity-45"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f8f0] text-[#658f4f]">
                            <Icon size={18} />
                          </div>
                          <ChevronRight size={15} className="text-[#b1b7aa] transition group-hover:translate-x-0.5" />
                        </div>
                        <p className="mt-4 text-[14px] font-medium text-[var(--iotiq-text)]">{action.title}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--iotiq-muted)]">{action.body}</p>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Firmware and lifecycle" subtitle="Compact actions for OTA and secure runtime refresh.">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                    <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Firmware posture</p>
                    <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">Current version: {firmwareVersion}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionButton icon={Upload} label="Push firmware" onClick={() => void runControlAction("ota")} disabled={actionBusy !== null} />
                      <ActionButton icon={RefreshCw} label="Re-scan" onClick={() => void runControlAction("sync")} disabled={actionBusy !== null} />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
                    <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Execution notes</p>
                    <div className="mt-3 space-y-2 text-[11px] text-[var(--iotiq-muted)]">
                      <div className="rounded-2xl bg-[#fafaf5] px-3 py-2">Runtime actions are sent through the Orbit IoT orchestration layer.</div>
                      <div className="rounded-2xl bg-[#fafaf5] px-3 py-2">Protected credential material is never auto-rendered in the control surface.</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "Connectivity" ? (
            <div className="grid gap-4">
              <SectionCard title="Realtime connectivity" subtitle="Transport confidence and secure link posture.">
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[22px] border border-[#dcebd6] bg-[linear-gradient(180deg,#f7fbf3_0%,#ffffff_100%)] px-4 py-4">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--iotiq-text)]">
                      <span className="inventory-pulse-dot bg-[#7caf63]" />
                      Transport active
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--iotiq-muted)]">
                      Device is associated with {connectionType} transport and has secure asset references synced from provisioning.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-[11px] text-[var(--iotiq-muted)]">Thing</p>
                        <p className="mt-1 text-[12px] font-medium text-[var(--iotiq-text)]">{thingId}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-[11px] text-[var(--iotiq-muted)]">Region</p>
                        <p className="mt-1 text-[12px] font-medium text-[var(--iotiq-text)]">{secureRegion}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Link diagnostics</p>
                      <Wifi size={16} className="text-[#7caf63]" />
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      {[
                        ["Last sync", formatDateTime(lastSyncAt)],
                        ["Signal quality", signalQuality],
                        ["Secure asset state", secureState],
                        ["Provisioning version", String(onboardingVersion || 1)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl bg-[#fafaf5] px-3 py-2">
                          <span className="text-[var(--iotiq-muted)]">{label}</span>
                          <span className="font-medium text-[var(--iotiq-text)]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "Certificates" ? (
            <div className="grid gap-4">
              <SectionCard title="Protected credential assets" subtitle="Sensitive certificate material stays masked until an operator validates access.">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--iotiq-text)]">
                      <Lock size={15} className="text-[#7caf63]" />
                      Protected storage
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      {[
                        ["Certificate ID", credentialsUnlocked ? certificateId ?? "Unavailable" : maskValue(certificateId)],
                        ["Certificate ARN", credentialsUnlocked ? certificateArn ?? "Unavailable" : maskValue(certificateArn, 12, 10)],
                        ["Bucket", secureBucket],
                        ["Object path", credentialsUnlocked ? secureObjectKey ?? "Unavailable" : maskValue(secureObjectKey, 12, 12)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                          <span className="text-[var(--iotiq-muted)]">{label}</span>
                          <span className="max-w-[56%] truncate font-medium text-[var(--iotiq-text)]">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionButton icon={KeyRound} label={credentialsUnlocked ? "Unlocked" : "Reveal credentials"} onClick={() => void handleRevealCredentials()} />
                      <ActionButton
                        icon={Copy}
                        label="Copy cert ARN"
                        onClick={() => certificateArn && void copyText(certificateArn)}
                        disabled={!credentialsUnlocked || !certificateArn}
                      />
                    </div>
                    {documentsError ? <p className="mt-3 text-[11px] text-[#a55a4d]">{documentsError}</p> : null}
                  </div>

                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Secure document bundle</p>
                    <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                      Private keys and certificate payloads stay concealed until validated for this session.
                    </p>
                    <div className="mt-4 space-y-2">
                      {[
                        { key: "certificate", label: "Device certificate", value: documents?.certificate },
                        { key: "privateKey", label: "Private key", value: documents?.privateKey },
                        { key: "publicKey", label: "Public key", value: documents?.publicKey },
                        { key: "metadata", label: "Metadata manifest", value: documents?.metadata },
                      ].map((entry) => {
                        const documentValue = entry.value ?? undefined;

                        return (
                          <div key={entry.key} className="rounded-2xl border border-[var(--iotiq-border)] bg-[#fafaf5] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[12px] font-medium text-[var(--iotiq-text)]">{entry.label}</p>
                                <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                                  {credentialsUnlocked
                                    ? documentValue
                                      ? "Protected asset loaded"
                                      : documentsLoading
                                        ? "Fetching secure asset"
                                        : "No asset available"
                                    : "Protected credential"}
                                </p>
                              </div>
                              <Lock size={14} className="text-[#7caf63]" />
                            </div>
                            {credentialsUnlocked && documentValue ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <ActionButton icon={Copy} label="Copy" onClick={() => void copyText(documentValue)} />
                                <ActionButton
                                  icon={Download}
                                  label="Download"
                                  onClick={() => downloadFile(`${serialNumber}-${entry.key}.txt`, documentValue, "text/plain;charset=utf-8")}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "Logs" ? (
            <SectionCard title="Operational timeline" subtitle="A compact history stitched from inventory, provisioning, and QR lifecycle markers.">
              <div className="space-y-3">
                {timeline.map((entry) => (
                  <div key={entry.label} className="flex gap-3 rounded-[20px] border border-[var(--iotiq-border)] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f4f8f0] text-[#658f4f]">
                      <Clock3 size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--iotiq-text)]">{entry.label}</p>
                      <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{entry.time}</p>
                      <p className="mt-1 text-[11px] text-[#8d9187]">{entry.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "OTA" ? (
            <SectionCard title="OTA readiness" subtitle="Firmware visibility and upgrade preparation in one compact surface.">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Current build</p>
                  <p className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-[var(--iotiq-text)]">{firmwareVersion}</p>
                  <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">Latest value reported from device metadata.</p>
                </div>
                <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                  <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Upgrade actions</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton icon={Upload} label="Push firmware" onClick={() => void runControlAction("ota")} disabled={actionBusy !== null} />
                    <ActionButton icon={RefreshCw} label="Verify state" onClick={() => void runControlAction("sync")} disabled={actionBusy !== null} />
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "Monitoring" ? (
            <div className="grid gap-4">
              <SectionCard title="Monitoring widgets" subtitle="Operational health cards that stay useful even without a live telemetry stream.">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--iotiq-text)]">
                      <Activity size={15} className="text-[#7caf63]" />
                      Device health
                    </div>
                    <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">
                      {status === "active" ? "Stable" : "Attention"}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{overviewInsights.body}</p>
                  </div>

                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--iotiq-text)]">
                      <ShieldCheck size={15} className="text-[#d9b14a]" />
                      Secure posture
                    </div>
                    <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">{secureState}</p>
                    <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                      {certificateId ? "Certificate references are attached to the runtime identity." : "Secure asset sync is still being confirmed."}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--iotiq-text)]">
                      <AlertTriangle size={15} className="text-[#7caf63]" />
                      Alert state
                    </div>
                    <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">
                      {status === "active" ? "Quiet" : "Watch"}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                      {status === "active" ? "No anomalies detected in the latest snapshot." : "Review connectivity and runtime actions."}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {provisioningError ? (
            <div className="rounded-[18px] border border-[#efddd8] bg-[#fff7f5] px-4 py-3 text-[11px] text-[#a55a4d]">
              {provisioningError}
            </div>
          ) : null}

          {detailsLoading ? (
            <div className="flex items-center gap-2 rounded-[18px] border border-[var(--iotiq-border)] bg-white px-4 py-3 text-[11px] text-[var(--iotiq-muted)]">
              <RefreshCw size={13} className="animate-spin" />
              Refreshing live device context
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
