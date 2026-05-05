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
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function maskKey(value: PrimitiveValue | undefined) {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) return "—";
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
        return ["name", "domain", "applicationCode", "applicationType", "authType"]
          .some((key) => String(row[key] ?? "").toLowerCase().includes(query));
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
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save application");
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
    <div className="space-y-8">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <AppWindowBadge />
              Application Console
            </div>
            <h1 className="text-[42px] font-black tracking-[-0.04em] text-slate-950">Trusted Client Registry</h1>
            <p className="max-w-[50rem] text-[14px] text-slate-600">
              Create the mobile and web applications that are allowed to scan device QR codes, claim devices, and issue commands later through the console service.
            </p>
          </div>

          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <MetricCard label="Registered Apps" value={String(rows.length)} helper="Applications in the console" />
            <MetricCard label="Active Clients" value={String(activeApps)} helper="Ready to claim devices" />
            <MetricCard label="QR Ready" value={String(rows.length)} helper="Can be linked to enrollment flow" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search applications..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={formOpen ? () => { resetForm(); setFormOpen(false); } : openCreate}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition ${
                formOpen
                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  : "bg-slate-950 text-white hover:bg-slate-800"
              }`}
            >
              {formOpen ? <X size={14} /> : <Plus size={14} />}
              {formOpen ? "Close" : "Create App"}
            </button>
          </div>

          {error ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
              {error}
            </p>
          ) : null}
          {loading ? <p className="text-[12px] text-slate-500">Loading applications...</p> : null}

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["Name", "Code", "Domain", "Type", "Auth", "App Key", "Created", "Actions"].map((label) => (
                    <th key={label} className="whitespace-nowrap px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
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
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-bold text-slate-900">{String(row.name ?? "—")}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-slate-600">{String(row.applicationCode ?? "—")}</td>
                      <td className="px-5 py-4 text-slate-600">{String(row.domain ?? "—")}</td>
                      <td className="px-5 py-4"><Tag value={String(row.applicationType ?? "—")} tone="blue" /></td>
                      <td className="px-5 py-4"><Tag value={String(row.authType ?? "—")} tone="emerald" /></td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => row.appKey ? void copyToClipboard(String(row.id), String(row.appKey)) : undefined}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
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
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Edit application"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="QR ready"
                          >
                            <QrCode size={13} />
                          </button>
                          {deleteConfirm === row.id ? (
                            <div className="flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1 text-[11px]">
                              <button type="button" className="font-bold text-rose-700" onClick={() => void handleDelete(row.id)}>Yes</button>
                              <span className="text-rose-200">/</span>
                              <button type="button" className="font-semibold text-slate-500" onClick={() => setDeleteConfirm(null)}>No</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(row.id)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                {editingId ? "Update Application" : "Create New Application"}
              </p>
              <p className="mt-1 text-[13px] text-slate-500">
                Enter the details for the new application
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Advanced Options
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
                helper="Drop application icon here, or browse browse"
                subHelper="Supports PNG, JPG & WEBP up to 3MB"
                value={formValues.image}
                inputId="app-image-upload"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleFileUpload(event, "image", 3)}
              />

              <UploadField
                label="Icon"
                helper="SVG"
                subHelper="Upload SVG icon (max 1MB)"
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
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
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

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <button type="button" onClick={() => { resetForm(); setFormOpen(false); }} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-[13px] font-bold text-white hover:bg-slate-800">
                {editingId ? "Save Changes" : "Create Application"}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-sky-700">
              <RefreshCw size={13} />
              Console Service Notes
            </div>
            <p className="mt-2 text-[13px] text-sky-800">
              Each application receives a generated server `appKey` from the backend. That key is separate from the access key and secret key fields you configure here for your own client integration settings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

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
      <span className="text-[13px] font-semibold text-slate-700">
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
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={onChange} />
        <label htmlFor={inputId} className="cursor-pointer">
          <p className="text-[13px] text-slate-600">{helper}</p>
          <p className="mt-1 text-[11px] text-slate-400">{subHelper}</p>
          {hasValue ? (
            <p className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              Uploaded
            </p>
          ) : null}
        </label>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-[32px] font-black tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-[12px] text-slate-600">{helper}</p>
    </article>
  );
}

function Tag({ value, tone }: { value: string; tone: "blue" | "emerald" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{value}</span>;
}

function Alert({ tone, message }: { tone: "rose"; message: string }) {
  const toneClass = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "";
  return <p className={`rounded-xl border px-4 py-3 text-[12px] ${toneClass}`}>{message}</p>;
}

function AppWindowBadge() {
  return <QrCode size={13} />;
}
