import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  KeyRound,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { deviceInventoryApi } from "../device-inventory/api";
import { useCrudResource } from "../device-inventory/hooks";

type PrimitiveValue = string | number | boolean | null;

type AppRow = { 
  id: string | number;
  createdAt: string;
  updatedAt: string;
  appKey?: string;
  status?: string;
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

export default function ApplicationConsolePage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formValues, setFormValues] = useState<FormState>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const activeApps = rows.filter((row) => String(row.status ?? "active").toLowerCase() === "active").length;

  const resetForm = () => {
    setFormValues(INITIAL_FORM);
    setEditingId(null);
    setSubmitError(null);
    setUploadError(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
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
    setFormOpen(true);
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
    } catch (uploadError) {
      setUploadError(uploadError instanceof Error ? uploadError.message : "Upload failed");
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
      setFormOpen(false);
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : "Failed to save application");
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

  return (
    <div className="app-console-theme space-y-6">
      <section className="flow-module-hero overflow-hidden rounded-[32px] px-6 py-7 md:px-8">
        <div className="flow-module-hero__mesh" aria-hidden="true" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200">
              <AppWindowBadge />
              Trusted Clients
            </div>
            <h1 className="text-[34px] font-semibold tracking-[-0.055em] text-white md:text-[42px]">
              Application Access Console
            </h1>
            <p className="max-w-[50rem] text-[13px] leading-7 text-slate-300">
              Register the mobile and web clients that are allowed to scan device QR codes, claim devices, and participate in secure device control flows.
            </p>
          </div>

          <div className="flex min-w-full flex-wrap gap-6 lg:min-w-[420px] lg:justify-end">
            <InlineMetric label="Registered Apps" value={String(rows.length)} />
            <InlineMetric label="Active Clients" value={String(activeApps)} />
            <InlineMetric label="QR Ready" value={String(rows.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.08)] backdrop-blur-md">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="app-shell-search relative min-w-[240px] flex-1 px-1">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search applications"
                className="app-shell-input h-11 w-full border-0 bg-transparent pl-10 pr-4 text-[12.5px] text-slate-700 shadow-none outline-none"
              />
            </div>

            <button
              type="button"
              onClick={formOpen ? () => { resetForm(); setFormOpen(false); } : openCreate}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[12px] font-medium transition ${
                formOpen
                  ? "border border-white/70 bg-white/60 text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.12)] hover:bg-white/75"
                  : "bg-slate-900 text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800"
              }`}
            >
              {formOpen ? <X size={14} /> : <Plus size={14} />}
              {formOpen ? "Close Panel" : "New Application"}
            </button>
          </div>

          {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{error}</p> : null}
          {loading ? <p className="text-[12px] text-slate-500">Loading applications...</p> : null}

          <div className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/70">
                  {["Name", "Code", "Domain", "Type", "Auth", "App Key", "Created", "Actions"].map((label) => (
                    <th key={label} className="whitespace-nowrap px-5 py-4 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-20 text-center text-[13px] text-slate-500">
                      No applications created yet.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="motion-soft border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-medium text-slate-900">{String(row.name ?? "-")}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-slate-600">{String(row.applicationCode ?? "-")}</td>
                      <td className="px-5 py-4 text-slate-600">{String(row.domain ?? "-")}</td>
                      <td className="px-5 py-4"><Tag value={String(row.applicationType ?? "-")} tone="blue" /></td>
                      <td className="px-5 py-4"><Tag value={String(row.authType ?? "-")} tone="emerald" /></td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => row.appKey ? void copyToClipboard(String(row.id), String(row.appKey)) : undefined}
                          className="motion-soft inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                        >
                          <KeyRound size={11} />
                          {copiedKey === String(row.id) ? "Copied" : maskKey(row.appKey)}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{fmtDate(row.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="motion-soft rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Edit application"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="motion-soft rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="QR ready"
                          >
                            <QrCode size={13} />
                          </button>
                          {deleteConfirm === row.id ? (
                            <div className="flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50/80 px-2 py-1 text-[10.5px]">
                              <button type="button" className="font-medium text-rose-700" onClick={() => void handleDelete(row.id)}>Yes</button>
                              <span className="text-rose-200">/</span>
                              <button type="button" className="font-medium text-slate-500" onClick={() => setDeleteConfirm(null)}>No</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(row.id)}
                              className="motion-soft rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete application"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.08)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[21px] font-semibold tracking-[-0.03em] text-slate-900">
                {editingId ? "Update Application" : "Create New Application"}
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Enter the details for the application profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="motion-soft inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[11.5px] font-medium text-slate-600 hover:bg-white"
            >
              Advanced
              <ChevronDown size={14} className={`transition ${showAdvanced ? "rotate-180" : ""}`} />
            </button>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSave}>
            <Field label="Application Name" required>
              <input value={formValues.name} onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))} placeholder="Enter application name" className={inputClass} required />
            </Field>

            <Field label="Domain" required>
              <input value={formValues.domain} onChange={(event) => setFormValues((prev) => ({ ...prev, domain: event.target.value }))} placeholder="Enter domain" className={inputClass} required />
            </Field>

            <Field label="Description">
              <textarea value={formValues.description} onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))} placeholder="Enter application description" rows={3} className={`${inputClass} min-h-[92px] py-3`} />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Application Code" required>
                <input value={formValues.applicationCode} onChange={(event) => setFormValues((prev) => ({ ...prev, applicationCode: event.target.value }))} className={inputClass} required />
              </Field>

              <Field label="Application Type" required>
                <select value={formValues.applicationType} onChange={(event) => setFormValues((prev) => ({ ...prev, applicationType: event.target.value }))} className={inputClass} required>
                  <option value="Web">Web</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Desktop">Desktop</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <UploadField
                label="Image"
                helper="Drop application artwork here, or browse"
                subHelper="Supports PNG, JPG, and WEBP up to 3MB"
                value={formValues.image}
                inputId="app-image-upload"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleFileUpload(event, "image", 3)}
              />

              <UploadField
                label="Icon"
                helper="SVG icon"
                subHelper="Upload SVG icon up to 1MB"
                value={formValues.icon}
                inputId="app-icon-upload"
                accept="image/svg+xml"
                onChange={(event) => void handleFileUpload(event, "icon", 1)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Bundle Version" required>
                <input value={formValues.bundleVersion} onChange={(event) => setFormValues((prev) => ({ ...prev, bundleVersion: event.target.value }))} className={inputClass} required />
              </Field>

              <Field label="Auth Type" required>
                <select value={formValues.authType} onChange={(event) => setFormValues((prev) => ({ ...prev, authType: event.target.value }))} className={inputClass} required>
                  <option value="Bearer">Bearer</option>
                  <option value="ApiKey">ApiKey</option>
                  <option value="OAuth2">OAuth2</option>
                </select>
              </Field>
            </div>

            {showAdvanced ? (
              <div className="space-y-4 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  <Shield size={13} />
                  Advanced Options
                </div>

                <Field label="SDK URL">
                  <input value={formValues.sdkUrl} onChange={(event) => setFormValues((prev) => ({ ...prev, sdkUrl: event.target.value }))} placeholder="Enter SDK URL" className={inputClass} />
                </Field>

                <Field label="Bundle URL">
                  <input value={formValues.bundleUrl} onChange={(event) => setFormValues((prev) => ({ ...prev, bundleUrl: event.target.value }))} placeholder="Enter bundle URL" className={inputClass} />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Secret Key">
                    <input value={formValues.secretKey} onChange={(event) => setFormValues((prev) => ({ ...prev, secretKey: event.target.value }))} placeholder="Enter secret key" className={inputClass} />
                  </Field>
                  <Field label="Access Key">
                    <input value={formValues.accessKey} onChange={(event) => setFormValues((prev) => ({ ...prev, accessKey: event.target.value }))} placeholder="Enter access key" className={inputClass} />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Client ID">
                    <input value={formValues.clientId} onChange={(event) => setFormValues((prev) => ({ ...prev, clientId: event.target.value }))} placeholder="Enter client ID" className={inputClass} />
                  </Field>
                  <Field label="Header Key">
                    <input value={formValues.headerKey} onChange={(event) => setFormValues((prev) => ({ ...prev, headerKey: event.target.value }))} placeholder="Enter header key" className={inputClass} />
                  </Field>
                </div>
              </div>
            ) : null}

            {uploadError ? <Alert tone="rose" message={uploadError} /> : null}
            {submitError ? <Alert tone="rose" message={submitError} /> : null}

            <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-5">
              <button type="button" onClick={() => { resetForm(); setFormOpen(false); }} className="motion-soft rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-[12px] font-medium text-slate-600 hover:bg-white">
                Cancel
              </button>
              <button type="submit" className="motion-soft rounded-full bg-slate-900 px-5 py-3 text-[12px] font-medium text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 hover:bg-slate-800">
                {editingId ? "Save Changes" : "Create Application"}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-[18px] border border-sky-200/80 bg-sky-50/80 p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              <RefreshCw size={13} />
              Console Notes
            </div>
            <p className="mt-2 text-[12.5px] leading-6 text-sky-800">
              Each application receives a generated server app key from the backend. That key is separate from the access key and secret key fields you configure here for client integration settings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputClass = "app-shell-input w-full px-4 text-[12.5px] text-slate-700 outline-none transition";

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
      <span className="text-[12px] font-medium text-slate-600">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function UploadField({
  label,
  helper,
  subHelper,
  value,
  inputId,
  accept,
  onChange,
}: {
  label: string;
  helper: string;
  subHelper: string;
  value: string;
  inputId: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const hasValue = Boolean(value);
  return (
    <div className="space-y-1.5">
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
      <div className="rounded-[24px] border border-dashed border-white/75 bg-white/45 px-4 py-6 text-center shadow-[0_14px_30px_rgba(148,163,184,0.1)] backdrop-blur-xl">
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={onChange} />
        <label htmlFor={inputId} className="cursor-pointer">
          <p className="text-[12.5px] text-slate-600">{helper}</p>
          <p className="mt-1 text-[11px] text-slate-400">{subHelper}</p>
          {hasValue ? (
            <p className="mt-3 inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50/70 px-3 py-1 text-[10.5px] font-medium text-emerald-700">
              Uploaded
            </p>
          ) : null}
        </label>
      </div>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[130px] rounded-[22px] border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

function Tag({ value, tone }: { value: string; tone: "blue" | "emerald" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/80 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${tones[tone]}`}>{value}</span>;
}

function Alert({ tone, message }: { tone: "rose"; message: string }) {
  const toneClass = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "";
  return <p className={`rounded-2xl border px-4 py-3 text-[12px] ${toneClass}`}>{message}</p>;
}

function AppWindowBadge() {
  return <QrCode size={13} />;
}
