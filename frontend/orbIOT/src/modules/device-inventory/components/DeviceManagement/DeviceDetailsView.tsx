import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  FileText,
  KeyRound,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { deviceInventoryApi } from "../../api";

type PrimitiveValue = string | number | boolean | null;

interface DeviceDetailsViewProps {
  device: Record<string, PrimitiveValue>;
  onBack: () => void;
  onEdit: () => void;
}

const TABS = [
  "Overview",
  "Monitoring",
  "Control Panel",
  "Components",
  "Connectivity",
  "Documentation",
  "Alerts",
  "Reports",
  "Settings",
] as const;

const ROOT_CA_CERT = `-----BEGIN CERTIFICATE-----
MIIE...AmazonRootCA1...AB
Q9n9M4V2...k3s2M9e...
-----END CERTIFICATE-----`;

interface IotDocuments {
  certificate?: string | null;
  privateKey?: string | null;
  publicKey?: string | null;
  metadata?: string | null;
}

interface IotMetadata {
  thingId?: string | null;
  thingName?: string | null;
  certificateId?: string | null;
  certificateArn?: string | null;
  policyAttached?: string | null;
  bucket?: string | null;
  documents?: IotDocuments | null;
}

interface CatalogMetadata {
  vendorName?: string | null;
  itemType?: string | null;
  itemName?: string | null;
  itemCode?: string | null;
  communicationPolicy?: string | null;
}

interface MqttDocumentBundle {
  certificate: string | null;
  privateKey: string | null;
  publicKey: string | null;
  metadata: string | null;
}

function parseIotMetadata(value: PrimitiveValue | undefined): IotMetadata | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { iot?: IotMetadata };
    if (!parsed?.iot || typeof parsed.iot !== "object") return null;
    return parsed.iot;
  } catch {
    return null;
  }
}

function parseCatalogMetadata(value: PrimitiveValue | undefined): CatalogMetadata | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { catalog?: CatalogMetadata };
    if (!parsed?.catalog || typeof parsed.catalog !== "object") return null;
    return parsed.catalog;
  } catch {
    return null;
  }
}

function text(value: PrimitiveValue | undefined, fallback = "-"): string {
  if (value === null || value === undefined) return fallback;
  const rendered = String(value).trim();
  return rendered ? rendered : fallback;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function downloadTextFile(fileName: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function tileClass(): string {
  return "rounded-xl border border-slate-200 bg-white shadow-sm";
}

function CopyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
    >
      <Copy size={12} /> {label}
    </button>
  );
}

function ConfigRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-[12px] text-slate-700">{value}</p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label={`Copy ${label}`}
        >
          <Copy size={13} />
        </button>
      ) : null}
    </div>
  );
}

function SecurityChip({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "blue" | "green" | "red";
}) {
  const toneMap: Record<typeof tone, string> = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-rose-600",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="flex items-center gap-2 text-[14px] font-bold text-slate-800">
        <span className={toneMap[tone]}>{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>
    </div>
  );
}

function DocumentPreview({
  title,
  fileName,
  content,
  copyLabel,
  onCopy,
  onDownload,
}: {
  title: string;
  fileName: string;
  content: string;
  copyLabel: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500">{title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-700">{fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton label={copyLabel} onClick={onCopy} />
          <CopyButton label="Download" onClick={onDownload} />
        </div>
      </div>
      <pre className="mt-3 max-h-28 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[10px] leading-4 text-slate-600">
{content}
      </pre>
    </div>
  );
}

function CertificateCard({
  title,
  subtitle,
  fileName,
  content,
  tone,
  copyLabel,
  onCopy,
  downloadLabel,
  onDownload,
}: {
  title: string;
  subtitle: string;
  fileName: string;
  content: string;
  tone: "blue" | "green" | "red";
  copyLabel: string;
  onCopy: () => void;
  downloadLabel: string;
  onDownload: () => void;
}) {
  const toneMap: Record<typeof tone, string> = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-rose-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <span className={toneMap[tone]}>
          <KeyRound size={14} />
        </span>
        {title}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>

      <div className="mt-4 flex items-center justify-between">
        <p className="font-mono text-[12px] font-semibold text-slate-700">{fileName}</p>
        <div className="flex items-center gap-2">
          <CopyButton label={copyLabel} onClick={onCopy} />
          <CopyButton label={downloadLabel} onClick={onDownload} />
        </div>
      </div>

      <pre className="mt-3 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-4 text-slate-600">
{content}
      </pre>
    </div>
  );
}

export default function DeviceDetailsView({ device, onBack, onEdit }: DeviceDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mqttDocuments, setMqttDocuments] = useState<MqttDocumentBundle>({
    certificate: null,
    privateKey: null,
    publicKey: null,
    metadata: null,
  });
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const title = text(device.name, "Unnamed Device");
  const serial = text(device.serialNumber, "-");
  const status = text(device.status, "provisioning").toUpperCase();
  const connection = text(device.connectionType, "MQTT").toUpperCase();
  const catalogMeta = useMemo(() => parseCatalogMetadata(device.metadata), [device.metadata]);
  const itemName = text(
    (catalogMeta?.itemName ?? catalogMeta?.itemType ?? device.itemTypeName ?? device.itemType) as PrimitiveValue,
    "Turbo 1 SC"
  );
  const vendorName = text((catalogMeta?.vendorName ?? device.vendorName) as PrimitiveValue, "IOTIQ Connect");
  const communication = text(
    (catalogMeta?.communicationPolicy ?? device.communicationPolicy) as PrimitiveValue,
    "Turbo 1 SC_policy"
  );
  const project = text(device.project, "5129dd20-90e5-4a32-8e99-7fb97a634c7b");

  const iotMeta = useMemo(() => parseIotMetadata(device.metadata), [device.metadata]);
  const thingIdRaw = readString(iotMeta?.thingId) ?? readString(device.foreignId);
  const thingNameRaw = readString(iotMeta?.thingName);
  const documentPaths = {
    certificate: readString(iotMeta?.documents?.certificate),
    privateKey: readString(iotMeta?.documents?.privateKey),
    publicKey: readString(iotMeta?.documents?.publicKey),
    metadata: readString(iotMeta?.documents?.metadata),
  };

  const endpoint = text(device.endpoint, "a1r6z29mxc63px-ats.iot.ap-south-1.amazonaws.com");
  const mqttPort = text(device.port, "8883 (MQTT over TLS)");
  const thingName = text(thingNameRaw, title.replace(/\s+/g, "_"));
  const thingId = text(
    (thingIdRaw ?? device.id) as PrimitiveValue,
    "ee13e4bd-14a0-455e-97df-7a1ab5f80dfa"
  );
  const certificateId = text(iotMeta?.certificateId as PrimitiveValue, "-");
  const certificateArn = text(iotMeta?.certificateArn as PrimitiveValue, "-");
  const policyAttached = text(iotMeta?.policyAttached as PrimitiveValue, "-");

  const lastUpdate = useMemo(() => {
    const value = device.updatedAt;
    if (!value) return "19 February at 05:32:50 pm";
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString("en-US", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [device.updatedAt]);

  const mqttCode = useMemo(
    () => `import ssl
import paho.mqtt.client as mqtt
import json
import time

# AWS IoT connection configuration
AWS_IOT_ENDPOINT = "${endpoint}"
AWS_IOT_PORT = 8883
THING_NAME = "${thingName}"
CLIENT_ID = "${thingId}"

ROOT_CA_PATH = "AmazonRootCA1.pem"
DEVICE_CERT_PATH = "device-certificate.pem"
PRIVATE_KEY_PATH = "private-key.pem"

client = mqtt.Client(client_id=CLIENT_ID)
client.tls_set(
    ca_certs=ROOT_CA_PATH,
    certfile=DEVICE_CERT_PATH,
    keyfile=PRIVATE_KEY_PATH,
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLSv1_2,
)

client.connect(AWS_IOT_ENDPOINT, AWS_IOT_PORT, keepalive=60)
client.loop_start()`,
    [endpoint, thingId, thingName]
  );

  const copyToClipboard = async (key: string, value: string): Promise<void> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1400);
    } catch {
      setCopiedKey(null);
    }
  };

  useEffect(() => {
    const connectAdminDeviceId = thingIdRaw;
    const hasPath = Boolean(
      documentPaths.certificate ||
      documentPaths.privateKey ||
      documentPaths.publicKey ||
      documentPaths.metadata
    );

    if (!connectAdminDeviceId || !hasPath) {
      setMqttDocuments({
        certificate: null,
        privateKey: null,
        publicKey: null,
        metadata: null,
      });
      setDocumentsError(null);
      setDocumentsLoading(false);
      return;
    }

    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError(null);

    void deviceInventoryApi.iot
      .getDeviceDocuments(connectAdminDeviceId, {
        ...(thingNameRaw ? { thingName: thingNameRaw } : {}),
        documentPaths,
      })
      .then((response) => {
        if (cancelled) return;
        setMqttDocuments(response.documents);
      })
      .catch((error) => {
        if (cancelled) return;
        setMqttDocuments({
          certificate: null,
          privateKey: null,
          publicKey: null,
          metadata: null,
        });
        setDocumentsError(error instanceof Error ? error.message : "Failed to load MQTT documents");
      })
      .finally(() => {
        if (cancelled) return;
        setDocumentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    documentPaths.certificate,
    documentPaths.metadata,
    documentPaths.privateKey,
    documentPaths.publicKey,
    thingIdRaw,
    thingNameRaw,
  ]);

  const renderOverview = () => (
    <>
      <div className={`${tileClass()} p-4`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ShieldCheck size={14} className="text-emerald-600" /> IoT Provisioning Snapshot
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Generated Thing ID and MQTT documents from device onboarding.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ConfigRow label="Thing ID" value={thingId} />
          <ConfigRow label="Certificate ID" value={certificateId} />
          <ConfigRow label="Certificate ARN" value={certificateArn} />
          <ConfigRow label="Policy" value={policyAttached} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={`${tileClass()} p-4 xl:col-span-2`}>
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">AI Insights</h3>
            <p className="text-[11px] text-slate-400">Just now</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-[13px] text-slate-500">
            No insights available for this device yet.
          </div>
        </div>

        <div className="grid gap-3">
          <div className={`${tileClass()} p-3`}>
            <p className="text-[11px] text-slate-400">Connection Status</p>
            <p className="mt-1 text-lg font-bold text-rose-500">Offline</p>
            <p className="text-[11px] text-slate-500">Device is offline and not connected.</p>
          </div>
          <div className={`${tileClass()} p-3`}>
            <p className="text-[11px] text-slate-400">Average Uptime</p>
            <p className="mt-1 text-lg font-bold text-teal-500">0.0%</p>
            <p className="text-[11px] text-slate-500">Average uptime in the last 24 hours.</p>
          </div>
          <div className={`${tileClass()} p-3`}>
            <p className="text-[11px] text-slate-400">Device Status</p>
            <p className="mt-1 text-lg font-bold text-emerald-600">Online</p>
            <p className="text-[11px] text-slate-500">Current status of this device.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${tileClass()} p-4`}>
              <p className="text-sm font-bold text-slate-800">Current State</p>
              <p className="mt-1 text-[11px] text-slate-400">Last available state of the device</p>
              <div className="mt-8 text-center">
                <p className="text-base font-semibold text-slate-700">No Parameter States</p>
                <p className="mt-2 text-[12px] text-slate-500">
                  No parameter states are currently available.
                </p>
              </div>
            </div>
            <div className={`${tileClass()} p-4`}>
              <p className="text-sm font-bold text-slate-800">Parameter State</p>
              <p className="mt-1 text-[11px] text-slate-400">Parameter values over time</p>
              <div className="mt-8 text-center">
                <p className="text-base font-semibold text-slate-700">No Parameter History</p>
                <p className="mt-2 text-[12px] text-slate-500">
                  No parameter history is available for this range.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${tileClass()} p-4`}>
              <p className="text-sm font-bold text-slate-800">Device Statistics</p>
              <p className="mt-1 text-[11px] text-slate-400">Message usage and device events</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-3 text-center">
                  <p className="text-[10px] text-slate-500">Transactions</p>
                  <p className="mt-1 text-lg font-bold text-blue-600">0</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-3 text-center">
                  <p className="text-[10px] text-slate-500">State Changes</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600">0</p>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-3 text-center">
                  <p className="text-[10px] text-slate-500">Disconnections</p>
                  <p className="mt-1 text-lg font-bold text-rose-600">0</p>
                </div>
              </div>
              <p className="mt-6 text-center text-[12px] text-slate-500">No messages are available.</p>
            </div>

            <div className={`${tileClass()} p-4`}>
              <p className="text-sm font-bold text-slate-800">Device Activity</p>
              <p className="mt-1 text-[11px] text-slate-400">Message activity over the last 7 days</p>
              <div className="mt-4 grid grid-cols-14 gap-1">
                {Array.from({ length: 98 }).map((_, index) => (
                  <span key={index} className="h-2.5 w-2.5 rounded-sm bg-slate-100" />
                ))}
              </div>
              <p className="mt-4 text-[11px] text-slate-500">Less activity to more activity scale.</p>
            </div>
          </div>

          <div className={`${tileClass()} p-4`}>
            <p className="text-sm font-bold text-slate-800">Service Tickets</p>
            <p className="mt-1 text-[11px] text-slate-400">Support tickets for this device</p>
            <div className="mt-8 text-center">
              <p className="text-base font-semibold text-slate-700">No Tickets</p>
              <p className="mt-2 text-[12px] text-slate-500">No service tickets found for this device.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className={`${tileClass()} p-4`}>
            <p className="text-sm font-bold text-slate-800">Alert Distribution</p>
            <div className="mt-5 flex justify-between text-[12px] font-semibold">
              <span className="text-rose-500">0% Critical</span>
              <span className="text-amber-500">0% Warning</span>
              <span className="text-blue-500">0% Info</span>
            </div>
          </div>

          <div className={`${tileClass()} p-4`}>
            <p className="text-sm font-bold text-slate-800">Device Status Distribution</p>
            <p className="mt-8 text-center text-[12px] text-slate-500">No device status data available.</p>
          </div>

          <div className={`${tileClass()} overflow-hidden`}>
            <div className="h-44 bg-gradient-to-b from-sky-300 to-slate-200">
              <div className="relative h-full w-full bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.25),rgba(15,23,42,0.55))]">
                <MapPin size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-500" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
              <span>17.434536, 78.385539</span>
              <RefreshCw size={12} />
            </div>
          </div>

          <div className={`${tileClass()} p-4`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Clock3 size={14} /> Revision History
            </p>
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              {lastUpdate}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderConnectivity = () => (
    <div className="space-y-4">
      <div className={`${tileClass()} p-6`}>
        <h3 className="text-[24px] font-extrabold tracking-[-0.02em] text-slate-900">MQTT Connection Guide</h3>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          <CheckCircle2 size={14} className="mt-0.5" />
          <p>
            Device is provisioned and ready for connection. All certificates and configuration are
            available.
          </p>
        </div>
      </div>

      <div className={`${tileClass()} p-4`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Code2 size={14} className="text-blue-600" /> Connection Configuration
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Use these AWS IoT connection parameters for your MQTT client
        </p>

        <div className="mt-4 space-y-3">
          <ConfigRow
            label="AWS IoT Endpoint"
            value={endpoint}
            onCopy={() => {
              void copyToClipboard("endpoint", endpoint);
            }}
          />
          <ConfigRow label="Port" value={mqttPort} />
          <ConfigRow
            label="Thing Name"
            value={thingName}
            onCopy={() => {
              void copyToClipboard("thingName", thingName);
            }}
          />
          <ConfigRow
            label="Thing ID"
            value={thingId}
            onCopy={() => {
              void copyToClipboard("thingId", thingId);
            }}
          />
        </div>
      </div>

      <div className={`${tileClass()} p-4`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FileText size={14} className="text-indigo-600" /> MQTT Documents
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Real certificate files loaded from provisioning storage.
        </p>
        <div className="mt-4 space-y-3">
          <DocumentPreview
            title="Certificate"
            fileName="device-certificate.pem"
            content={
              documentsLoading
                ? "Loading certificate..."
                : mqttDocuments.certificate ?? "Certificate is not available for this device."
            }
            copyLabel={copiedKey === "certPreview" ? "Copied" : "Copy"}
            onCopy={() => {
              void copyToClipboard("certPreview", mqttDocuments.certificate ?? "");
            }}
            onDownload={() => {
              if (!mqttDocuments.certificate) return;
              downloadTextFile("device-certificate.pem", mqttDocuments.certificate);
            }}
          />
          <DocumentPreview
            title="Private Key"
            fileName="private-key.pem"
            content={
              documentsLoading
                ? "Loading private key..."
                : mqttDocuments.privateKey ?? "Private key is not available for this device."
            }
            copyLabel={copiedKey === "privatePreview" ? "Copied" : "Copy"}
            onCopy={() => {
              void copyToClipboard("privatePreview", mqttDocuments.privateKey ?? "");
            }}
            onDownload={() => {
              if (!mqttDocuments.privateKey) return;
              downloadTextFile("private-key.pem", mqttDocuments.privateKey);
            }}
          />
          <DocumentPreview
            title="Public Key"
            fileName="public-key.pem"
            content={
              documentsLoading
                ? "Loading public key..."
                : mqttDocuments.publicKey ?? "Public key is not available for this device."
            }
            copyLabel={copiedKey === "publicPreview" ? "Copied" : "Copy"}
            onCopy={() => {
              void copyToClipboard("publicPreview", mqttDocuments.publicKey ?? "");
            }}
            onDownload={() => {
              if (!mqttDocuments.publicKey) return;
              downloadTextFile("public-key.pem", mqttDocuments.publicKey);
            }}
          />
          <DocumentPreview
            title="Metadata"
            fileName="metadata.json"
            content={
              documentsLoading
                ? "Loading metadata..."
                : mqttDocuments.metadata ?? "Metadata is not available for this device."
            }
            copyLabel={copiedKey === "metaPreview" ? "Copied" : "Copy"}
            onCopy={() => {
              void copyToClipboard("metaPreview", mqttDocuments.metadata ?? "");
            }}
            onDownload={() => {
              if (!mqttDocuments.metadata) return;
              downloadTextFile("metadata.json", mqttDocuments.metadata);
            }}
          />
        </div>
        {documentsError ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {documentsError}
          </p>
        ) : null}
      </div>

      <div className={`${tileClass()} p-4`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ShieldCheck size={14} className="text-emerald-600" /> Security Requirements
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SecurityChip
            icon={<KeyRound size={14} />}
            title="Root CA Certificate"
            subtitle="Amazon Root CA 1"
            tone="blue"
          />
          <SecurityChip
            icon={<Shield size={14} />}
            title="Device Certificate"
            subtitle="X.509 Certificate"
            tone="green"
          />
          <SecurityChip
            icon={<Lock size={14} />}
            title="Private Key"
            subtitle="RSA Private Key"
            tone="red"
          />
        </div>
      </div>

      <div className={`${tileClass()} p-4`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Code2 size={14} className="text-blue-600" /> Code Examples
        </p>
        <p className="mt-1 text-[12px] text-slate-500">Choose your preferred implementation language</p>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-900/20">
          <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-white">
            <p className="text-[12px] font-semibold">Python MQTT Client</p>
            <button
              type="button"
              onClick={() => {
                void copyToClipboard("mqttCode", mqttCode);
              }}
              className="rounded border border-white/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-1">
                <Copy size={11} />
                {copiedKey === "mqttCode" ? "Copied" : "Copy"}
              </span>
            </button>
          </div>
          <pre className="max-h-64 overflow-auto bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{mqttCode}</pre>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
        <p className="flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5" />
          Keep your certificates secure and never share them publicly. Store them in a secure
          location with appropriate file permissions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CertificateCard
          title="Root CA Certificate"
          subtitle="Amazon Root CA 1"
          fileName="AmazonRootCA1.pem"
          content={ROOT_CA_CERT}
          tone="blue"
          copyLabel={copiedKey === "rootCA" ? "Copied" : "Copy"}
          downloadLabel="Download"
          onCopy={() => {
            void copyToClipboard("rootCA", ROOT_CA_CERT);
          }}
          onDownload={() => {
            downloadTextFile("AmazonRootCA1.pem", ROOT_CA_CERT);
          }}
        />
        <CertificateCard
          title="Device Certificate"
          subtitle="X.509 certificate for your device authentication"
          fileName="device-certificate.pem"
          content={mqttDocuments.certificate ?? "Device certificate is not available for this device."}
          tone="green"
          copyLabel={copiedKey === "deviceCert" ? "Copied" : "Copy"}
          downloadLabel="Download"
          onCopy={() => {
            void copyToClipboard("deviceCert", mqttDocuments.certificate ?? "");
          }}
          onDownload={() => {
            if (!mqttDocuments.certificate) return;
            downloadTextFile("device-certificate.pem", mqttDocuments.certificate);
          }}
        />
        <CertificateCard
          title="Private Key"
          subtitle="RSA private key for secure communication"
          fileName="private-key.pem"
          content={mqttDocuments.privateKey ?? "Private key is not available for this device."}
          tone="red"
          copyLabel={copiedKey === "privateKey" ? "Copied" : "Copy"}
          downloadLabel="Download"
          onCopy={() => {
            void copyToClipboard("privateKey", mqttDocuments.privateKey ?? "");
          }}
          onDownload={() => {
            if (!mqttDocuments.privateKey) return;
            downloadTextFile("private-key.pem", mqttDocuments.privateKey);
          }}
        />
        <CertificateCard
          title="Public Key"
          subtitle="Public key generated with certificate provisioning"
          fileName="public-key.pem"
          content={mqttDocuments.publicKey ?? "Public key is not available for this device."}
          tone="green"
          copyLabel={copiedKey === "publicKey" ? "Copied" : "Copy"}
          downloadLabel="Download"
          onCopy={() => {
            void copyToClipboard("publicKey", mqttDocuments.publicKey ?? "");
          }}
          onDownload={() => {
            if (!mqttDocuments.publicKey) return;
            downloadTextFile("public-key.pem", mqttDocuments.publicKey);
          }}
        />
        <CertificateCard
          title="Provisioning Metadata"
          subtitle="Generated metadata for this certificate set"
          fileName="metadata.json"
          content={mqttDocuments.metadata ?? "Metadata file is not available for this device."}
          tone="blue"
          copyLabel={copiedKey === "metadataDoc" ? "Copied" : "Copy"}
          downloadLabel="Download"
          onCopy={() => {
            void copyToClipboard("metadataDoc", mqttDocuments.metadata ?? "");
          }}
          onDownload={() => {
            if (!mqttDocuments.metadata) return;
            downloadTextFile("metadata.json", mqttDocuments.metadata);
          }}
        />
      </div>

      <div className={`${tileClass()} p-4`}>
        <h4 className="text-sm font-bold text-slate-800">File Setup Instructions</h4>
        <div className="mt-4 space-y-3 text-[13px] text-slate-700">
          <p className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">1</span>
            <span>
              <strong>Save the Root CA Certificate</strong>
              <br />
              Save the Amazon Root CA 1 content to a file named <code>AmazonRootCA1.pem</code>
            </span>
          </p>
          <p className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">2</span>
            <span>
              <strong>Save the Device Certificate</strong>
              <br />
              Save your device certificate to <code>device-certificate.pem</code>
            </span>
          </p>
          <p className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">3</span>
            <span>
              <strong>Save the Private Key</strong>
              <br />
              Save your private key to <code>private-key.pem</code>
            </span>
          </p>
          <p className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">4</span>
            <span>
              <strong>Set File Permissions</strong>
              <br />
              Ensure certificate files have appropriate permissions (e.g., <code>chmod 600 *.pem</code>)
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-blue-900">Need Help?</p>
            <p className="mt-1 text-[12px] text-blue-700">
              Check our troubleshooting guide or contact support if you encounter any issues.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-blue-700 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-600"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`${tileClass()} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Back to device list"
            >
              <ArrowLeft size={16} className="mx-auto" />
            </button>
            <div className="h-20 w-24 rounded-lg bg-slate-200/80 ring-1 ring-slate-300" />
            <div>
              <h2 className="text-[28px] font-extrabold tracking-[-0.03em] text-slate-900">{title}</h2>
              <p className="text-[12px] text-slate-500">#{serial}</p>

              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-slate-600 md:grid-cols-4">
                <p>
                  <span className="block text-[11px] text-slate-400">Item</span>
                  <span className="font-semibold text-slate-700">{itemName}</span>
                </p>
                <p>
                  <span className="block text-[11px] text-slate-400">Vendor</span>
                  <span className="font-semibold text-slate-700">{vendorName}</span>
                </p>
                <p>
                  <span className="block text-[11px] text-slate-400">Communication Policy</span>
                  <span className="font-semibold text-slate-700">{communication}</span>
                </p>
                <p>
                  <span className="block text-[11px] text-slate-400">Current Project</span>
                  <span className="font-semibold text-slate-700">{project}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              {status}
            </span>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
              {connection}
            </span>
            <span className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
              SECURE
            </span>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className={`${tileClass()} p-2`}>
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                activeTab === tab
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Connectivity" ? renderConnectivity() : renderOverview()}

      <div className={`${tileClass()} flex flex-wrap items-center gap-5 px-4 py-2 text-[11px] text-slate-500`}>
        <span className="flex items-center gap-1"><FileText size={12} /> Transactions</span>
        <span className="flex items-center gap-1"><AlertTriangle size={12} /> Alerts</span>
        <span className="flex items-center gap-1"><Wifi size={12} /> Realtime Logs</span>
        <span className="flex items-center gap-1"><Activity size={12} /> Annotations</span>
        <span className="ml-auto flex items-center gap-1"><Shield size={12} /> Device Health</span>
      </div>
    </div>
  );
}
