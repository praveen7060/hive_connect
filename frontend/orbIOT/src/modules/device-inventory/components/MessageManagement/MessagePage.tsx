import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import {
  Search,
  RotateCcw,
  Pencil,
  Trash2,   
  X,
  ChevronDown,
  Plus,
} from "lucide-react";
import MessagingForm from "./MessageForm";
import { buildDevicePageUrl, getAdjacentDeviceQueryKey } from "../management/flow";
import { RightDrawer } from "../management/ui";
import { deviceInventoryApi } from "../../api";
import { useCrudResource } from "../../hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type PrimitiveValue = string | number | boolean | null;

type MessageRow = {
  id: string | number;
  createdAt: string;
  updatedAt: string;
} & Record<string, PrimitiveValue>;

type ItemTypeEntityRow = {
  id: string | number;
  name?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

type CommunicationEntityRow = {
  id: string | number;
  name?: PrimitiveValue;
  itemType?: PrimitiveValue;
} & Record<string, PrimitiveValue>;

interface FilterConfig {
  key: string;
  label: string;
  options: string[];
}

interface ColumnConfig {
  key: string;
  label: string;
  format?: (value: PrimitiveValue | undefined, row: MessageRow) => string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

interface BadgeProps {
  value: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS: FilterConfig[] = [
  { key: "messageType", label: "Message Type", options: ["UPDATE", "AUTHENTICATE", "CONNECTION", "STATUS", "CONFIGURATION", "QUERY"] },
  { key: "commandType", label: "Command Type", options: ["PUBLISH", "SUBSCRIBE", "GET", "POST"] },
  { key: "policyType", label: "Policy Type", options: ["EXECUTE", "QUERY", "REGISTER", "BOOT", "SYNC", "OTA"] },
];

const COLUMNS: ColumnConfig[] = [
  { key: "topic", label: "Topic" },
  { key: "messageType", label: "Message Type" },
  { key: "commandType", label: "Command Type" },
  { key: "policyType", label: "Policy Type" },
  { key: "communicationPolicy", label: "Communication Policy" },
];

const INITIAL_ROWS: MessageRow[] = [];

const BADGE_KEYS = new Set(["messageType", "commandType", "policyType"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: PrimitiveValue | undefined): string {
  if (val === undefined || val === null || String(val).trim() === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (String(val).match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(String(val)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return String(val);
}

function buildDefaults(): Record<string, PrimitiveValue> {
  return {
    itemType: "",
    communicationPolicy: "",
    topic: "",
    messageType: "",
    commandType: "",
    policyType: "",
    communicationMethod: "",
    retainMessages: false,
    loggedMessage: false,
    topicUnique: false,
    isPayloadCentric: false,
    requestPayloadFormat: "",
    responsePayloadFormat: "",
    payloadFormat: "",
    confirmationPayloadFormat: "",
    qos: "",
    pollingInterval: "",
  };
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  ON_OFF: "bg-sky-50 text-sky-700 border-sky-200",
  UPDATE: "bg-sky-50 text-sky-700 border-sky-200",
  COMMAND: "bg-violet-50 text-violet-700 border-violet-200",
  EVENT: "bg-amber-50 text-amber-700 border-amber-200",
  AUTHENTICATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONNECTION: "bg-indigo-50 text-indigo-700 border-indigo-200",
  STATUS: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIGURATION: "bg-orange-50 text-orange-700 border-orange-200",
  QUERY: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PUBLISH: "bg-violet-50 text-violet-700 border-violet-200",
  SUBSCRIBE: "bg-blue-50 text-blue-700 border-blue-200",
  EXECUTE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REGISTER: "bg-amber-50 text-amber-700 border-amber-200",
  BOOT: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  SYNC: "bg-blue-50 text-blue-700 border-blue-200",
  OTA: "bg-rose-50 text-rose-700 border-rose-200",
  RESET: "bg-rose-50 text-rose-700 border-rose-200",
};

function Badge({ value }: BadgeProps) {
  const cls = BADGE_COLORS[value] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      {value}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="inventory-kpi-card rounded-2xl px-6 py-5 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p
        className="inventory-kpi-value text-[38px] leading-none mt-1"
      >
        {value}
      </p>
      <p className="text-[12px] text-slate-500 mt-1.5">{sub}</p>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Main Component ───────────────────────────────────────────────────────────
export default function MessagingManagementPage() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filters, setFilters] = useState<Record<string, string>>(
    FILTERS.reduce<Record<string, string>>((acc, f) => {
      acc[f.key] = "all";
      return acc;
    }, {})
  );
  const [formValues, setFormValues] = useState<Record<string, PrimitiveValue>>(buildDefaults());
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  const { rows, loading, error, createOne, updateOne, deleteOne } = useCrudResource<
    MessageRow,
    Partial<MessageRow>,
    Partial<MessageRow>
  >(deviceInventoryApi.messages, { initialRows: INITIAL_ROWS });
  const { rows: itemTypeRows, loading: itemTypesLoading } = useCrudResource<
    ItemTypeEntityRow,
    Partial<ItemTypeEntityRow>,
    Partial<ItemTypeEntityRow>
  >(deviceInventoryApi.itemTypes, { initialRows: [] });
  const { rows: communicationRows, loading: communicationPoliciesLoading } = useCrudResource<
    CommunicationEntityRow,
    Partial<CommunicationEntityRow>,
    Partial<CommunicationEntityRow>
  >(deviceInventoryApi.communications, { initialRows: [] });

  const filteredRows = useMemo<MessageRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const searchPass =
        !q ||
        ["name", "itemType", "topic", "messageType", "commandType", "policyType", "communicationPolicy"].some((k) =>
          String(row[k] ?? "").toLowerCase().includes(q)
        );
      const filterPass = FILTERS.every((f) => {
        const fv = filters[f.key];
        return !fv || fv === "all" || String(row[f.key] ?? "") === fv;
      });
      return searchPass && filterPass;
    });
  }, [filters, rows, searchTerm]);

  const commandCount = rows.filter((r) => String(r.commandType ?? "").toUpperCase() === "PUBLISH").length;
  const retainedCount = rows.filter((r) => Boolean(r.retainMessages)).length;
  const loggedCount = rows.filter((r) => Boolean(r.loggedMessage)).length;
  const itemTypeOptions = useMemo<string[]>(() => {
    const deduped = new Set<string>();

    itemTypeRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (name) deduped.add(name);
    });

    rows.forEach((row) => {
      const itemType = String(row.itemType ?? "").trim();
      if (itemType) deduped.add(itemType);
    });

    const selectedItemType = String(formValues.itemType ?? "").trim();
    if (selectedItemType) deduped.add(selectedItemType);

    return Array.from(deduped).sort((a, b) => a.localeCompare(b));
  }, [formValues.itemType, itemTypeRows, rows]);

  const communicationPolicyOptions = useMemo<string[]>(() => {
    const selectedItemType = String(formValues.itemType ?? "").trim().toLowerCase();
    const deduped = new Set<string>();

    communicationRows.forEach((row) => {
      const name = String(row.name ?? "").trim();
      if (!name) return;

      if (!selectedItemType) {
        deduped.add(name);
        return;
      }

      const itemType = String(row.itemType ?? "").trim().toLowerCase();
      if (!itemType || itemType === selectedItemType) {
        deduped.add(name);
      }
    });

    if (!selectedItemType) {
      rows.forEach((row) => {
        const policy = String(row.communicationPolicy ?? "").trim();
        if (policy) deduped.add(policy);
      });
    } else {
      rows.forEach((row) => {
        const rowItemType = String(row.itemType ?? "").trim().toLowerCase();
        const policy = String(row.communicationPolicy ?? "").trim();
        if (rowItemType === selectedItemType && policy) {
          deduped.add(policy);
        }
      });
    }

    const selectedPolicy = String(formValues.communicationPolicy ?? "").trim();
    if (selectedPolicy) deduped.add(selectedPolicy);

    return Array.from(deduped).sort((a, b) => a.localeCompare(b));
  }, [communicationRows, formValues.communicationPolicy, formValues.itemType, rows]);

  const openCreate = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(true);
  };

  const openEdit = (row: MessageRow): void => {
    setFormValues({
      itemType: row.itemType || "",
      communicationPolicy: row.communicationPolicy || "",
      topic: row.topic || "",
      messageType: row.messageType || "",
      commandType: row.commandType || "",
      policyType: row.policyType || "",
      communicationMethod: row.communicationMethod || "",
      retainMessages: Boolean(row.retainMessages),
      loggedMessage: Boolean(row.loggedMessage),
      topicUnique: Boolean(row.topicUnique),
      isPayloadCentric: Boolean(row.isPayloadCentric),
      requestPayloadFormat: String(row.requestPayloadFormat || row.payloadFormat || ""),
      responsePayloadFormat: String(row.responsePayloadFormat || row.confirmationPayloadFormat || ""),
      payloadFormat: String(row.payloadFormat || ""),
      confirmationPayloadFormat: String(row.confirmationPayloadFormat || ""),
      qos: Number(row.qos || 0) || "",
      pollingInterval: Number(row.pollingInterval || 0) || "",
    });
    setEditingId(row.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: string | number): Promise<void> => {
    try {
      await deleteOne(id);
    } catch {
      return;
    }
    setDeleteConfirm(null);
  };

  const saveMessagingPolicy = async (): Promise<boolean> => {
    const itemType = String(formValues.itemType ?? "").trim();
    const communicationPolicy = String(formValues.communicationPolicy ?? "").trim();
    const topic = String(formValues.topic ?? "").trim();
    const messageType = String(formValues.messageType ?? "").trim();
    const policyType = String(formValues.policyType ?? "").trim();
    if (!itemType || !communicationPolicy || !topic || !messageType || !policyType) {
      return false;
    }

    const now = new Date().toISOString();
    
    // Create a name from itemType and topic
    const name = `${itemType} - ${topic} Policy`;
    
    const payload = {
      name,
      itemType,
      communicationPolicy,
      topic,
      messageType,
      commandType: formValues.commandType,
      policyType,
      communicationMethod: String(formValues.commandType ?? ""),
      retainMessages: Boolean(formValues.retainMessages),
      loggedMessage: Boolean(formValues.loggedMessage),
      topicUnique: Boolean(formValues.topicUnique),
      isPayloadCentric: Boolean(formValues.isPayloadCentric),
      requestPayloadFormat: String(formValues.requestPayloadFormat ?? formValues.payloadFormat ?? ""),
      responsePayloadFormat: String(formValues.responsePayloadFormat ?? formValues.confirmationPayloadFormat ?? ""),
      payloadFormat: String(formValues.requestPayloadFormat ?? formValues.payloadFormat ?? ""),
      confirmationPayloadFormat: String(formValues.responsePayloadFormat ?? formValues.confirmationPayloadFormat ?? ""),
      qos: Number(formValues.qos ?? 0) || 0,
      pollingInterval: Number(formValues.pollingInterval ?? 0) || 0,
    };

    try {
      if (editingId !== null) {
        await updateOne(editingId, { ...payload, updatedAt: now });
      } else {
        await createOne({ ...payload, createdAt: now, updatedAt: now });
      }
    } catch {
      return false;
    }

    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(false);
    return true;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void saveMessagingPolicy();
  };

  const goToPreviousPage = (): void => {
    const previousPage = getAdjacentDeviceQueryKey("messagingPage", "previous") ?? "messagingPage";
    navigate(buildDevicePageUrl(previousPage));
  };

  const handleSaveAndNext = async (): Promise<void> => {
    const saved = await saveMessagingPolicy();
    if (!saved) return;

    const nextPage = getAdjacentDeviceQueryKey("messagingPage", "next");
    if (nextPage) {
      navigate(buildDevicePageUrl(nextPage));
    }
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setFormValues(buildDefaults());
    setFormOpen(false);
  };

  const handleFormValueChange = (key: string, value: PrimitiveValue): void => {
    if (key === "itemType") {
      setFormValues((prev) => ({
        ...prev,
        itemType: value,
        communicationPolicy: "",
      }));
      return;
    }
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = (): void => {
    setSearchTerm("");
    setFilters(
      FILTERS.reduce<Record<string, string>>((acc, f) => {
        acc[f.key] = "all";
        return acc;
      }, {})
    );
  };

  const hasActiveFilters: boolean =
    !!searchTerm || FILTERS.some((f) => filters[f.key] !== "all");

  const resolveCell = (col: ColumnConfig, row: MessageRow) => {
    const display = col.format ? col.format(row[col.key], row) : fmt(row[col.key]);
    if (BADGE_KEYS.has(col.key)) {
      return <Badge value={display} />;
    }
    return (
      <span
        className={`text-[13px] ${
          col.key === "name" ? "font-bold text-slate-900" : "font-normal text-slate-500"
        }`}
      >
        {display}
      </span>
    );
  };

  return (
    <div
      className="inventory-page-theme min-h-screen w-full"
    >
      <style>{`
        @keyframes slideInPanel {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .slide-in-panel {
          animation: slideInPanel 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex items-start justify-between px-12 pt-12 pb-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Device Configuration
          </p>
          <h1
            className="text-[44px] text-slate-900"
            style={{ fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}
          >
            Messaging Policies
          </h1>
          <p className="mt-2.5 text-[14px] text-slate-500">
            Create messaging policies used by items and devices.
          </p>
        </div>

        <button
          type="button"
          onClick={formOpen ? handleCancel : openCreate}
          className={`mt-1 flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold shadow-md transition-all active:scale-95 ${
            formOpen
              ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              : "bg-slate-900 text-white hover:bg-slate-700 hover:shadow-lg"
          }`}
        >
          {formOpen ? (
            <>
              <X size={14} strokeWidth={2.5} />
              Close
            </>
          ) : (
            <>
              <Plus size={15} strokeWidth={2.5} />
              Add Policy
            </>
          )}
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="px-12 mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Policies"
          value={String(rows.length)}
          sub="all messaging policies"
        />
        <StatCard
          label="Publish Topics"
          value={String(commandCount)}
          sub="publish-to-device topics"
        />
        <StatCard
          label="Retained"
          value={String(retainedCount)}
          sub="with retain messages"
        />
        <StatCard
          label="Logged"
          value={String(loggedCount)}
          sub="with message logging"
        />
      </div>
      {error && (
        <div className="px-12 mt-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        </div>
      )}
      {loading && (
        <div className="px-12 mt-4">
          <p className="text-[12px] text-slate-500">Loading messaging policies...</p>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="px-12 mt-8 pb-14 flex gap-6 items-start">

        {/* ── Table column ── */}
        <div className="flex-1 min-w-0">

          {/* Filter bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search policies…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {FILTERS.map((f) => (
              <div key={f.key} className="relative">
                <select
                  value={filters[f.key]}
                  onChange={(e) =>
                    setFilters((c) => ({ ...c, [f.key]: e.target.value }))
                  }
                  className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 cursor-pointer"
                >
                  <option value="all">{f.label}</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 h-11 text-[13px] text-slate-500 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors"
              >
                <RotateCcw size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="whitespace-nowrap px-6 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <Search size={18} className="text-slate-400" />
                          </div>
                          <p className="text-[13px] font-semibold text-slate-500">No policies found</p>
                          <p className="text-[12px] text-slate-400">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70 ${
                          editingId === row.id ? "bg-blue-50/30" : ""
                        }`}
                      >
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="whitespace-nowrap px-6 py-4">
                            {resolveCell(col, row)}
                          </td>
                        ))}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className={`rounded-lg p-2 transition-colors ${
                                editingId === row.id
                                  ? "bg-blue-100 text-blue-600"
                                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              }`}
                              aria-label="Edit messaging policy"
                            >
                              <Pencil size={13} strokeWidth={2.2} />
                            </button>

                            {deleteConfirm === row.id ? (
                              <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                                <span className="text-[11px] font-semibold text-red-600 mr-1">
                                  Delete?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(row.id)}
                                  className="text-[11px] font-bold text-red-600 hover:text-red-800 transition-colors"
                                >
                                  Yes
                                </button>
                                <span className="text-red-200 mx-0.5">/</span>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(row.id)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                aria-label="Delete messaging policy"
                              >
                                <Trash2 size={13} strokeWidth={2.2} />
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
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-[11px] font-semibold text-slate-400">
              <span>
                {filteredRows.length} polic{filteredRows.length !== 1 ? "ies" : "y"}
              </span>
              <span>
                {filteredRows.length === 0
                  ? "0 results"
                  : `1–${filteredRows.length} of ${rows.length}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Side Form Panel ── */}
        <RightDrawer open={formOpen} onClose={handleCancel} size="large">
          <div className="inventory-form-body h-full overflow-y-auto px-6 py-6">
            <MessagingForm
                  formId="messaging-form"
                  formTitle={editingId ? "Edit Policy" : "New Messaging Policy"}
                  formSubtitle={
                    editingId
                      ? "Update the messaging policy details below."
                      : "Create a messaging policy used by items and devices."
                  }
                  values={formValues}
                  itemTypeOptions={itemTypeOptions}
                  communicationPolicyOptions={communicationPolicyOptions}
                  itemTypesLoading={itemTypesLoading}
                  communicationPoliciesLoading={communicationPoliciesLoading}
                  onValueChange={handleFormValueChange}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  onBack={goToPreviousPage}
                  onSaveAndNext={handleSaveAndNext}
                  editing={!!editingId}
            />
          </div>
        </RightDrawer>
      </div>
    </div>
  );
}




