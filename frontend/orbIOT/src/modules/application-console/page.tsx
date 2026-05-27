import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AppWindow,
  CheckCircle2,
  ChevronDown,
  Copy,
  Link2,
  Pencil,
  Plus,
  QrCode,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { RightDrawer } from "../device-inventory/components/management/ui";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;

type AppRow = { 
  id: string | number;
  createdAt: string;
  updatedAt: string;
  appKey?: string;
  status?: string;
  metadata?: string;
} & Record<string, PrimitiveValue>;
  
type FormState = {
  name: string;
  domain: string;
  description: string;
  applicationCode: string;
  applicationType: string;
  image: string;
  icon: string;
  bundleVersion: string;
  authType: string;
  sdkUrl: string;
  bundleUrl: string;
  secretKey: string;
  accessKey: string;
  clientId: string;
  headerKey: string;
};

type DrawerMode = "create" | "edit" | "link";

type LinkDraft = {
  appId: string;
  clientId: string;
  token: string;
  qrPayload: string;
  qrSvg: string;
  deepLink: string;
  expiresAt: string;
  installationId: string;
  generatedAt: string;
  linked: boolean;
};

const INITIAL_FORM: FormState = {
  name: "",
  domain: "",
  description: "",
  applicationCode: "LHT",
  applicationType: "Web",
  image: "",
  icon: "",
  bundleVersion: "0.1",
  authType: "Bearer",
  sdkUrl: "",
  bundleUrl: "",
  secretKey: "",
  accessKey: "",
  clientId: "",
  headerKey: "",
};

const INITIAL_LINK_DRAFT: LinkDraft = {
  appId: "",
  clientId: "",
  token: "",
  qrPayload: "",
  qrSvg: "",
  deepLink: "",
  expiresAt: "",
  installationId: "",
  generatedAt: "",
  linked: false,
};

const DRAWER_FORM_ID = "application-console-drawer-form";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function fmtDate(value: PrimitiveValue | undefined) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function maskKey(value: PrimitiveValue | undefined) {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) return "-";
  if (stringValue.length <= 8) return stringValue;
  return `${stringValue.slice(0, 4)}...${stringValue.slice(-4)}`;
}

function parseMetadata(value: PrimitiveValue | undefined): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getLinkedMeta(row: AppRow) {
  const metadata = parseMetadata(row.metadata);
  const linked = metadata.linkedAccount;
  if (!linked || typeof linked !== "object" || Array.isArray(linked)) {
    return {
      linked: false,
      clientId: "",
      token: "",
      linkedAt: "",
      status: "unlinked",
    };
  }

  const record = linked as Record<string, unknown>;
  return {
    linked: Boolean(record.linked),
    clientId: typeof record.clientId === "string" ? record.clientId : "",
    token: typeof record.token === "string" ? record.token : "",
    linkedAt: typeof record.linkedAt === "string" ? record.linkedAt : "",
    status: typeof record.status === "string" ? record.status : "linked",
  };
}

function getAppLinkSessionMeta(row: AppRow) {
  const metadata = parseMetadata(row.metadata);
  const appLinkSessions =
    metadata.appLinkSessions && typeof metadata.appLinkSessions === "object" && !Array.isArray(metadata.appLinkSessions)
      ? (metadata.appLinkSessions as Record<string, unknown>)
      : {};
  const pending = Array.isArray(appLinkSessions.pending)
    ? (appLinkSessions.pending as Array<Record<string, unknown>>)
    : [];
  const latestPending = [...pending]
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .sort(
      (left, right) =>
        new Date(String(right.issuedAt ?? "")).getTime() - new Date(String(left.issuedAt ?? "")).getTime()
    )[0];

  return {
    token: typeof latestPending?.token === "string" ? latestPending.token : "",
    deepLink: typeof latestPending?.deepLink === "string" ? latestPending.deepLink : "",
    expiresAt: typeof latestPending?.expiresAt === "string" ? latestPending.expiresAt : "",
    generatedAt: typeof latestPending?.issuedAt === "string" ? latestPending.issuedAt : "",
    clientId: typeof latestPending?.clientId === "string" ? latestPending.clientId : "",
    status: typeof latestPending?.status === "string" ? latestPending.status : "idle",
  };
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
  const { cells, size } = useMemo(() => buildPseudoQrMatrix(value || "orb-app-link"), [value]);
  const cellSize = 8;
  const dimension = size * cellSize;

  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      className="h-[188px] w-[188px] rounded-[20px] bg-white p-3 shadow-[0_12px_24px_rgba(17,17,17,0.08)]"
      aria-label="Link QR"
    >
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

function inputClass(multiline = false) {
  return multiline
    ? "w-full rounded-[18px] border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-3 text-[12.5px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]"
    : "h-11 w-full rounded-[18px] border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 text-[12.5px] text-[var(--iotiq-text)] outline-none transition focus:border-[var(--iotiq-primary)] focus:ring-2 focus:ring-[rgba(124,175,99,0.12)]";
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[var(--iotiq-text)]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function AppStatusPill({ linked }: { linked: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
        linked ? "bg-[#edf6e8] text-[#6b944f]" : "bg-[#f6f7f1] text-[#7a816f]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${linked ? "bg-[#7caf63]" : "bg-[#b8beb2]"}`} />
      {linked ? "Linked" : "Unlinked"}
    </span>
  );
}

export default function ApplicationConsolePage() {
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formValues, setFormValues] = useState<FormState>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft>(INITIAL_LINK_DRAFT);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    AppRow,
    Partial<AppRow>,
    Partial<AppRow>
  >(deviceInventoryApi.applicationConsoleApps, { initialRows: [] });

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return true;
        return ["name", "domain", "applicationCode", "applicationType", "authType"].some((key) =>
          String(row[key] ?? "").toLowerCase().includes(query)
        );
      }),
    [rows, searchTerm]
  );

  const stats = useMemo(() => {
    const activeApps = rows.filter((row) => String(row.status ?? "active").toLowerCase() === "active").length;
    const linkedApps = rows.filter((row) => getLinkedMeta(row).linked).length;
    return { activeApps, linkedApps };
  }, [rows]);

  const resetForm = () => {
    setFormValues(INITIAL_FORM);
    setEditingId(null);
    setSubmitError(null);
    setUploadError(null);
    setShowAdvanced(false);
  };

  const openCreate = () => {
    resetForm();
    setDrawerMode("create");
  };

  const openEdit = (row: AppRow) => {
    setFormValues({
      name: String(row.name ?? ""),
      domain: String(row.domain ?? ""),
      description: String(row.description ?? ""),
      applicationCode: String(row.applicationCode ?? "LHT"),
      applicationType: String(row.applicationType ?? "Web"),
      image: String(row.image ?? ""),
      icon: String(row.icon ?? ""),
      bundleVersion: String(row.bundleVersion ?? "0.1"),
      authType: String(row.authType ?? "Bearer"),
      sdkUrl: String(row.sdkUrl ?? ""),
      bundleUrl: String(row.bundleUrl ?? ""),
      secretKey: String(row.secretKey ?? ""),
      accessKey: String(row.accessKey ?? ""),
      clientId: String(row.clientId ?? ""),
      headerKey: String(row.headerKey ?? ""),
    });
    setEditingId(row.id);
    setSubmitError(null);
    setUploadError(null);
    setShowAdvanced(false);
    setDrawerMode("edit");
  };

  const openLink = (row?: AppRow) => {
    const target = row ?? rows[0];
    const meta = target ? getLinkedMeta(target) : null;
    const pendingMeta = target ? getAppLinkSessionMeta(target) : null;
    const token = meta?.token || "";
    setLinkDraft({
      appId: target ? String(target.id) : "",
      clientId: pendingMeta?.clientId || meta?.clientId || String(target?.clientId ?? ""),
      token: pendingMeta?.token || token,
      qrPayload: pendingMeta?.token
        ? JSON.stringify(
            {
              type: "app_account_link",
              appId: target?.id,
              token: pendingMeta.token,
              clientId: pendingMeta.clientId || meta?.clientId || target?.clientId,
              expiresAt: pendingMeta.expiresAt || undefined,
            },
            null,
            2
          )
        : token
          ? JSON.stringify({ appId: target?.id, token, clientId: meta?.clientId || target?.clientId }, null, 2)
          : "",
      qrSvg: "",
      deepLink: pendingMeta?.deepLink || "",
      expiresAt: pendingMeta?.expiresAt || "",
      installationId: "",
      generatedAt: pendingMeta?.generatedAt || meta?.linkedAt || "",
      linked: meta?.linked || false,
    });
    setLinkError(null);
    setLinkSuccess(null);
    setDrawerMode("link");
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setLinkError(null);
    setLinkSuccess(null);
  };

  const handleFileUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    field: "image" | "icon",
    sizeLimitMb: number
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > sizeLimitMb * 1024 * 1024) {
      setUploadError(`${field === "image" ? "Image" : "SVG icon"} exceeds ${sizeLimitMb}MB`);
      return;
    }

    setUploadError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormValues((prev) => ({ ...prev, [field]: dataUrl }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const payload = {
      ...formValues,
      description: formValues.description || undefined,
      image: formValues.image || undefined,
      icon: formValues.icon || undefined,
      sdkUrl: formValues.sdkUrl || undefined,
      bundleUrl: formValues.bundleUrl || undefined,
      secretKey: formValues.secretKey || undefined,
      accessKey: formValues.accessKey || undefined,
      clientId: formValues.clientId || undefined,
      headerKey: formValues.headerKey || undefined,
    };

    try {
      if (editingId !== null) {
        await updateOne(editingId, payload);
      } else {
        await createOne(payload);
      }
      resetForm();
      closeDrawer();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save application");
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteOne(id);
      setDeleteConfirm(null);
    } catch {
      return;
    }
  };

  const copyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
    } catch {
      setCopiedKey(null);
    }
  };

  const selectedLinkedApp = rows.find((row) => String(row.id) === linkDraft.appId) ?? null;

  const generateLinkQr = async () => {
    if (!linkDraft.appId) {
      setLinkError("Select an application before generating a link QR.");
      return;
    }

    try {
      const response = await deviceInventoryApi.applicationConsole.createLinkQr(linkDraft.appId, {
        clientId: linkDraft.clientId || undefined,
      });
      const qr = response?.qr && typeof response.qr === "object" ? (response.qr as Record<string, unknown>) : {};
      const payload = qr.payload && typeof qr.payload === "object" ? qr.payload : {};
      setLinkDraft((current) => ({
        ...current,
        token: typeof qr.token === "string" ? qr.token : "",
        qrPayload: JSON.stringify(payload, null, 2),
        qrSvg: typeof qr.svg === "string" ? qr.svg : "",
        deepLink: typeof qr.deepLink === "string" ? qr.deepLink : "",
        expiresAt: typeof response?.link?.expiresAt === "string" ? response.link.expiresAt : "",
        generatedAt: new Date().toISOString(),
        linked: false,
      }));
      setLinkError(null);
      setLinkSuccess("Link QR generated. Scan it from the mobile app to complete linking.");
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Unable to generate link QR");
    }
  };

  const confirmLink = async () => {
    if (!selectedLinkedApp || !linkDraft.token) {
      setLinkError("Generate a link QR before confirming the linked account.");
      return;
    }

    if (!linkDraft.installationId.trim()) {
      setLinkError("Enter an installation ID to simulate the mobile app link.");
      return;
    }

    try {
      await deviceInventoryApi.applicationConsole.claimLinkQr({
        qrToken: linkDraft.token,
        installationId: linkDraft.installationId.trim(),
        clientId: linkDraft.clientId || undefined,
        platform: "web-preview",
        appVersion: "orbIOT-console",
      });
      setLinkDraft((current) => ({ ...current, linked: true }));
      setLinkSuccess(`Linked account confirmed for ${selectedLinkedApp.name}.`);
      setLinkError(null);
      await updateOne(selectedLinkedApp.id, {
        clientId: linkDraft.clientId || undefined,
      });
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to confirm linked account");
    }
  };

  const drawerTitle =
    drawerMode === "edit"
      ? "Update Application"
      : drawerMode === "link"
        ? "Link App Account"
        : "New Application";

  return (
    <div className="app-console-theme space-y-5">
      <section className="rounded-[28px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(17,17,17,0.04)] md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcebd6] bg-[#f4f8f0] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#648d4f]">
              <AppWindow size={13} />
              Trusted Clients
            </div>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.055em] text-[var(--iotiq-text)] md:text-[34px]">
              Application Access Console
            </h1>
            <p className="mt-2 max-w-[52rem] text-[13px] leading-6 text-[var(--iotiq-muted)]">
              Register application profiles, manage claim readiness, and link trusted client accounts from one compact console.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Registered apps" value={String(rows.length)} />
            <Metric label="Active clients" value={String(stats.activeApps)} />
            <Metric label="Linked accounts" value={String(stats.linkedApps)} />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(17,17,17,0.04)] md:px-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="app-shell-search relative min-w-[240px] flex-1 px-1">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search applications"
              className="app-shell-input h-11 w-full border-0 bg-transparent pl-10 pr-4 text-[12.5px] text-slate-700 shadow-none outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#222222]"
            >
              <Plus size={14} />
              New Application
            </button>
            <button
              type="button"
              onClick={() => openLink()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-2.5 text-[12px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
            >
              <Link2 size={14} />
              Link App Account
            </button>
          </div>
        </div>

        {error ? <Alert message={error} /> : null}
        {loading ? <p className="text-[12px] text-[var(--iotiq-muted)]">Loading applications...</p> : null}

        {filteredRows.length === 0 && !loading ? (
          <div className="rounded-[24px] border border-dashed border-[var(--iotiq-border)] bg-[#fafaf5] px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#7caf63] shadow-[0_10px_24px_rgba(17,17,17,0.05)]">
              <AppWindow size={24} />
            </div>
            <p className="mt-4 text-[15px] font-medium text-[var(--iotiq-text)]">No applications registered yet</p>
            <p className="mt-2 text-[12.5px] text-[var(--iotiq-muted)]">
              Start by creating an application profile or linking an existing app account.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white"
              >
                <Plus size={14} />
                New Application
              </button>
              <button
                type="button"
                onClick={() => openLink()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-white px-4 py-2.5 text-[12px] font-medium text-[var(--iotiq-text)]"
              >
                <Link2 size={14} />
                Link App Account
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-[var(--iotiq-border)] bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--iotiq-border)] bg-[#fafaf5]">
                  {["Application", "Code", "Domain", "Type", "Auth", "Link", "Created", "Actions"].map((label) => (
                    <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const linkedMeta = getLinkedMeta(row);
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-[#fcfcf8]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-[var(--iotiq-border)] bg-[#fafaf5] text-[#7caf63]">
                            {String(row.icon ?? "").trim() ? (
                              <img src={String(row.icon)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <AppWindow size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[var(--iotiq-text)]">{String(row.name ?? "-")}</p>
                            <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{String(row.bundleVersion ?? "-")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[var(--iotiq-muted)]">{String(row.applicationCode ?? "-")}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--iotiq-muted)]">{String(row.domain ?? "-")}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--iotiq-text)]">{String(row.applicationType ?? "-")}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--iotiq-text)]">{String(row.authType ?? "-")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AppStatusPill linked={linkedMeta.linked} />
                          {linkedMeta.clientId ? (
                            <span className="text-[11px] text-[var(--iotiq-muted)]">{linkedMeta.clientId}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--iotiq-muted)]">{fmtDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => row.appKey ? void copyToClipboard(String(row.id), String(row.appKey)) : undefined}
                            className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-2.5 py-1 text-[10.5px] text-[var(--iotiq-muted)] transition hover:bg-white"
                          >
                            {copiedKey === String(row.id) ? "Copied" : maskKey(row.appKey)}
                          </button>
                          <button
                            type="button"
                            onClick={() => openLink(row)}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Link app account"
                          >
                            <QrCode size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Edit application"
                          >
                            <Pencil size={13} />
                          </button>
                          {deleteConfirm === row.id ? (
                            <div className="flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2 py-1 text-[10.5px]">
                              <button type="button" className="font-medium text-rose-700" onClick={() => void handleDelete(row.id)}>Yes</button>
                              <span className="text-rose-200">/</span>
                              <button type="button" className="font-medium text-slate-500" onClick={() => setDeleteConfirm(null)}>No</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(row.id)}
                              className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete application"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RightDrawer open={drawerMode !== null} onClose={closeDrawer} size="compact">
        <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fcfcf8_0%,#f7f8f2_100%)]">
          <div className="sticky top-0 z-10 border-b border-[var(--iotiq-border)] bg-white/90 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">
                  {drawerMode === "link" ? "Account linking" : "Application profile"}
                </p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-[var(--iotiq-text)]">{drawerTitle}</h2>
                <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">
                  {drawerMode === "link"
                    ? "Generate the link token, present the QR, and confirm the trusted client account."
                    : "Create or update application access settings without taking over the whole page."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] text-[var(--iotiq-text)] transition hover:bg-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {drawerMode === "link" ? (
              <div className="space-y-4">
                <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                  <div className="space-y-4">
                    <Field label="Application" required>
                      <select
                        value={linkDraft.appId}
                        onChange={(event) => setLinkDraft((current) => ({ ...current, appId: event.target.value }))}
                        className={inputClass()}
                      >
                        <option value="">Select application</option>
                        {rows.map((row) => (
                          <option key={row.id} value={String(row.id)}>
                            {String(row.name ?? "-")}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Client ID">
                      <input
                        value={linkDraft.clientId}
                        onChange={(event) => setLinkDraft((current) => ({ ...current, clientId: event.target.value }))}
                        className={inputClass()}
                        placeholder="Enter mobile/web client ID"
                      />
                    </Field>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateLinkQr}
                        className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#222222]"
                      >
                        <QrCode size={14} />
                        Generate QR
                      </button>
                      <button
                        type="button"
                        onClick={confirmLink}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-2.5 text-[12px] font-medium text-[var(--iotiq-text)] transition hover:bg-white"
                      >
                        <CheckCircle2 size={14} />
                        Simulate Mobile Link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-4">
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      {linkDraft.qrSvg ? (
                        <div
                          className="flex h-[188px] w-[188px] items-center justify-center overflow-hidden rounded-[20px] bg-white p-3 shadow-[0_12px_24px_rgba(17,17,17,0.08)]"
                          dangerouslySetInnerHTML={{ __html: linkDraft.qrSvg }}
                        />
                      ) : (
                        <PseudoQr value={linkDraft.qrPayload || linkDraft.token || "app-link"} />
                      )}
                      <p className="text-[11px] text-[var(--iotiq-muted)]">
                        {linkDraft.token ? "Scan from the mobile app to link this trusted account." : "Generate a link QR to begin."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                      <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Link session</p>
                      <div className="mt-3 space-y-2 text-[11px]">
                        <Row label="Application" value={selectedLinkedApp ? String(selectedLinkedApp.name) : "Not selected"} />
                        <Row label="Client ID" value={linkDraft.clientId || "Not entered"} />
                        <Row label="Token" value={linkDraft.token || "Not generated"} />
                        <Row label="Deep link" value={linkDraft.deepLink || "Pending"} />
                        <Row label="Expires" value={linkDraft.expiresAt ? fmtDate(linkDraft.expiresAt) : "Pending"} />
                        <Row label="Generated" value={linkDraft.generatedAt ? fmtDate(linkDraft.generatedAt) : "Pending"} />
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                      <p className="text-[13px] font-medium text-[var(--iotiq-text)]">Mobile simulator</p>
                      <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">
                        Optional helper for testing the mobile link claim without opening the native app.
                      </p>
                      <div className="mt-3 space-y-3">
                        <Field label="Installation ID">
                          <input
                            value={linkDraft.installationId}
                            onChange={(event) =>
                              setLinkDraft((current) => ({ ...current, installationId: event.target.value }))
                            }
                            className={inputClass()}
                            placeholder="device-installation-id"
                          />
                        </Field>
                      </div>
                    </div>

                    {linkDraft.qrPayload ? (
                      <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-[var(--iotiq-text)]">QR payload</p>
                          <button
                            type="button"
                            onClick={() => void copyToClipboard("link-payload", linkDraft.qrPayload)}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-3 text-[11px] text-[var(--iotiq-text)]"
                          >
                            <Copy size={12} />
                            Copy
                          </button>
                        </div>
                        <pre className="mt-3 overflow-x-auto rounded-[18px] bg-[#fafaf5] p-3 text-[10.5px] leading-5 text-[var(--iotiq-muted)]">
{linkDraft.qrPayload}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>

                {linkError ? <Alert message={linkError} /> : null}
                {linkSuccess ? (
                  <div className="rounded-[18px] border border-[#dcebd6] bg-[#f6fbf2] px-4 py-3 text-[12px] text-[#51753d]">
                    {linkSuccess}
                  </div>
                ) : null}
              </div>
            ) : (
              <form id={DRAWER_FORM_ID} className="space-y-4" onSubmit={handleSave}>
                <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.04)]">
                  <div className="grid gap-4">
                    <Field label="Application Name" required>
                      <input value={formValues.name} onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))} placeholder="Enter application name" className={inputClass()} required />
                    </Field>

                    <Field label="Domain" required>
                      <input value={formValues.domain} onChange={(event) => setFormValues((prev) => ({ ...prev, domain: event.target.value }))} placeholder="Enter domain" className={inputClass()} required />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Application Code" required>
                        <input value={formValues.applicationCode} onChange={(event) => setFormValues((prev) => ({ ...prev, applicationCode: event.target.value }))} className={inputClass()} required />
                      </Field>

                      <Field label="Application Type" required>
                        <select value={formValues.applicationType} onChange={(event) => setFormValues((prev) => ({ ...prev, applicationType: event.target.value }))} className={inputClass()} required>
                          <option value="Web">Web</option>
                          <option value="Mobile">Mobile</option>
                          <option value="Desktop">Desktop</option>
                        </select>
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Auth Type" required>
                        <select value={formValues.authType} onChange={(event) => setFormValues((prev) => ({ ...prev, authType: event.target.value }))} className={inputClass()} required>
                          <option value="Bearer">Bearer</option>
                          <option value="ApiKey">ApiKey</option>
                          <option value="OAuth2">OAuth2</option>
                        </select>
                      </Field>

                      <Field label="Bundle Version" required>
                        <input value={formValues.bundleVersion} onChange={(event) => setFormValues((prev) => ({ ...prev, bundleVersion: event.target.value }))} className={inputClass()} required />
                      </Field>
                    </div>

                    <Field label="Description">
                      <textarea value={formValues.description} onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))} placeholder="Enter application description" rows={3} className={inputClass(true)} />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <UploadField
                        label="Image"
                        helper="Upload application artwork"
                        value={formValues.image}
                        inputId="app-image-upload"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => void handleFileUpload(event, "image", 3)}
                      />

                      <UploadField
                        label="Icon"
                        helper="Upload SVG icon"
                        value={formValues.icon}
                        inputId="app-icon-upload"
                        accept="image/svg+xml"
                        onChange={(event) => void handleFileUpload(event, "icon", 1)}
                      />
                    </div>

                    <div className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] p-3">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--iotiq-muted)]"
                      >
                        <Shield size={13} />
                        Advanced
                        <ChevronDown size={14} className={`transition ${showAdvanced ? "rotate-180" : ""}`} />
                      </button>

                      {showAdvanced ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="SDK URL">
                              <input value={formValues.sdkUrl} onChange={(event) => setFormValues((prev) => ({ ...prev, sdkUrl: event.target.value }))} className={inputClass()} />
                            </Field>
                            <Field label="Bundle URL">
                              <input value={formValues.bundleUrl} onChange={(event) => setFormValues((prev) => ({ ...prev, bundleUrl: event.target.value }))} className={inputClass()} />
                            </Field>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Secret Key">
                              <input value={formValues.secretKey} onChange={(event) => setFormValues((prev) => ({ ...prev, secretKey: event.target.value }))} className={inputClass()} />
                            </Field>
                            <Field label="Access Key">
                              <input value={formValues.accessKey} onChange={(event) => setFormValues((prev) => ({ ...prev, accessKey: event.target.value }))} className={inputClass()} />
                            </Field>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Client ID">
                              <input value={formValues.clientId} onChange={(event) => setFormValues((prev) => ({ ...prev, clientId: event.target.value }))} className={inputClass()} />
                            </Field>
                            <Field label="Header Key">
                              <input value={formValues.headerKey} onChange={(event) => setFormValues((prev) => ({ ...prev, headerKey: event.target.value }))} className={inputClass()} />
                            </Field>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {uploadError ? <Alert message={uploadError} /> : null}
                {submitError ? <Alert message={submitError} /> : null}
              </form>
            )}
          </div>

          <div className="border-t border-[var(--iotiq-border)] bg-white/90 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--iotiq-muted)]">
                {drawerMode === "link"
                  ? "Linked status is stored on the application record metadata."
                  : "Advanced credentials stay collapsed until needed."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full border border-[var(--iotiq-border)] bg-[#fcfcf8] px-4 py-2 text-[12px] font-medium text-[var(--iotiq-text)]"
                >
                  Close
                </button>
                {drawerMode !== "link" ? (
                  <button
                    type="submit"
                    form={DRAWER_FORM_ID}
                    className="rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white"
                  >
                    {editingId ? "Save Changes" : "Create Application"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </RightDrawer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[130px] rounded-[20px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-[var(--iotiq-text)]">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[16px] bg-[#fafaf5] px-3 py-2">
      <span className="text-[var(--iotiq-muted)]">{label}</span>
      <span className="max-w-[58%] truncate font-medium text-[var(--iotiq-text)]">{value}</span>
    </div>
  );
}

function Alert({ message }: { message: string }) {
  return <p className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{message}</p>;
}

function UploadField({
  label,
  helper,
  value,
  inputId,
  accept,
  onChange,
}: {
  label: string;
  helper: string;
  value: string;
  inputId: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[12px] font-medium text-[var(--iotiq-text)]">{label}</span>
      <div className="rounded-[22px] border border-dashed border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-5 text-center">
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={onChange} />
        <label htmlFor={inputId} className="cursor-pointer">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#7caf63] shadow-[0_8px_18px_rgba(17,17,17,0.05)]">
            <Upload size={16} />
          </div>
          <p className="mt-3 text-[12px] text-[var(--iotiq-text)]">{helper}</p>
          <p className="mt-1 text-[11px] text-[var(--iotiq-muted)]">{value ? "Uploaded" : "PNG, JPG, WEBP or SVG"}</p>
        </label>
      </div>
    </div>
  );
}
