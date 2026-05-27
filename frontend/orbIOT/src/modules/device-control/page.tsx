import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  Cpu,
  Play,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { RightDrawer } from "../device-inventory/components/management/ui";
import { deviceControlApi } from "./api";
import { useDeviceControlData } from "./hooks";
import type {
  CatalogProfileResponse,
  ClaimedDeviceRecord,
  CommandDefinition,
  DeviceCatalogSummary,
  ExecuteCommandInput,
} from "./types";

type ActionDraft = {
  installationId: string;
  parameters: Record<string, string>;
  payloadJson: string;
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function humanizeCommandKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeMessageLabel(action: CommandDefinition) {
  return action.name?.trim() || humanizeCommandKey(action.key);
}

function parseFallbackCommands(device: ClaimedDeviceRecord) {
  const metadata = parseJsonObject(device.device.metadata);
  const catalog = (metadata.catalog ?? {}) as Record<string, unknown>;
  const commandsRaw = (catalog.commands ?? {}) as Record<string, unknown>;

  return Object.entries(commandsRaw).map(([key, value]) => {
    const record = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

    return {
      key,
      messageId: key,
      name: humanizeCommandKey(key),
      topicTemplate: typeof record.topic === "string" ? record.topic : undefined,
      subTopic: typeof record.subTopic === "string" ? record.subTopic : undefined,
      payloadTemplate:
        record.payloadTemplate && typeof record.payloadTemplate === "object" && !Array.isArray(record.payloadTemplate)
          ? (record.payloadTemplate as Record<string, unknown>)
          : undefined,
    } satisfies CommandDefinition;
  });
}

function parseCommandDefinitions(
  device: ClaimedDeviceRecord,
  profile?: CatalogProfileResponse | null
): DeviceCatalogSummary {
  const metadata = parseJsonObject(device.device.metadata);
  const catalog = (metadata.catalog ?? {}) as Record<string, unknown>;
  const commands = profile?.commands?.length ? profile.commands : parseFallbackCommands(device);

  return {
    vendorName: String(catalog.vendorName ?? catalog.vendor ?? "Unmapped"),
    itemCode: String(profile?.item?.itemCode ?? catalog.itemCode ?? "-"),
    itemName: String(profile?.item?.name ?? catalog.itemName ?? catalog.itemType ?? device.device.name ?? "-"),
    communicationPolicy: String(profile?.communication?.name ?? catalog.communicationPolicy ?? "-"),
    channels: String(profile?.provisioning?.channels ?? catalog.channels ?? "-"),
    thingId: String(profile?.thingId ?? catalog.thingId ?? "-"),
    connectAdminDeviceId: String(
      profile?.connectAdminDeviceId ?? catalog.connectAdminDeviceId ?? device.device.serialNumber ?? "-"
    ),
    commands,
  };
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
      Object.values(value).forEach(walk);
    }
  }

  walk(payloadTemplate);
  return Array.from(keys);
}

function createInitialDraft(device: ClaimedDeviceRecord, action: CommandDefinition): ActionDraft {
  const parameterKeys = collectParameterKeys(action.payloadTemplate);
  return {
    installationId: String(device.installationId ?? ""),
    parameters: Object.fromEntries(parameterKeys.map((key) => [key, ""])),
    payloadJson: JSON.stringify(action.payloadTemplate ?? {}, null, 2),
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActionDescription(action: CommandDefinition) {
  const parameterKeys = collectParameterKeys(action.payloadTemplate);
  const direction = [action.communicationMethod, action.commandType].filter(Boolean).join(" / ");
  if (parameterKeys.length > 0) {
    return `Configure ${parameterKeys.join(", ")} before sending this topic action.${direction ? ` ${direction}.` : ""}`;
  }
  return `Ready from the communication policy topic mapping.${direction ? ` ${direction}.` : ""}`;
}

function DeviceControlMetric({
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
    <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Live</span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-[13px] text-slate-500">{helper}</p>
    </article>
  );
}

export default function DeviceControlPage() {
  const { apps, selectedApp, selectedAppId, setSelectedAppId, claimedDevices, appsLoading, devicesLoading, error } =
    useDeviceControlData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<CommandDefinition | null>(null);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [catalogProfiles, setCatalogProfiles] = useState<Record<string, CatalogProfileResponse>>({});
  const [profilesLoading, setProfilesLoading] = useState(false);

  useEffect(() => {
    if (!claimedDevices.length) {
      setSelectedClaimId("");
      return;
    }

    setSelectedClaimId((current) =>
      current && claimedDevices.some((entry) => entry.id === current) ? current : claimedDevices[0].id
    );
  }, [claimedDevices]);

  useEffect(() => {
    let mounted = true;

    const loadProfiles = async () => {
      if (!claimedDevices.length) {
        setCatalogProfiles({});
        return;
      }

      setProfilesLoading(true);
      try {
        const results = await Promise.all(
          claimedDevices.map(async (entry) => {
            try {
              const profile = await deviceControlApi.getCatalogProfile(entry.device.id);
              return [entry.device.id, profile] as const;
            } catch {
              return [entry.device.id, null] as const;
            }
          })
        );

        if (!mounted) return;
        setCatalogProfiles(
          Object.fromEntries(results.filter(([, profile]) => Boolean(profile))) as Record<string, CatalogProfileResponse>
        );
      } finally {
        if (mounted) setProfilesLoading(false);
      }
    };

    void loadProfiles();

    return () => {
      mounted = false;
    };
  }, [claimedDevices]);

  const filteredDevices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return claimedDevices.filter((entry) => {
      if (!query) return true;
      const catalog = parseCommandDefinitions(entry, catalogProfiles[entry.device.id]);
      return [
        entry.device.name,
        entry.device.serialNumber,
        catalog.vendorName,
        catalog.itemCode,
        entry.installationId,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [catalogProfiles, claimedDevices, searchTerm]);

  const selectedDevice = filteredDevices.find((entry) => entry.id === selectedClaimId) ?? filteredDevices[0] ?? null;
  const selectedProfile = selectedDevice ? catalogProfiles[selectedDevice.device.id] ?? null : null;
  const selectedCatalog = selectedDevice ? parseCommandDefinitions(selectedDevice, selectedProfile) : null;

  const metrics = useMemo(() => {
    const totalActions = filteredDevices.reduce(
      (sum, entry) => sum + parseCommandDefinitions(entry, catalogProfiles[entry.device.id]).commands.length,
      0
    );
    const elevateClaims = filteredDevices.filter(
      (entry) => parseCommandDefinitions(entry, catalogProfiles[entry.device.id]).vendorName.toUpperCase() === "ELEVATE"
    ).length;

    return {
      trustedApps: apps.length,
      claimedDevices: filteredDevices.length,
      configurableActions: totalActions,
      elevateClaims,
    };
  }, [apps.length, catalogProfiles, filteredDevices]);

  const openActionDrawer = (device: ClaimedDeviceRecord, action: CommandDefinition) => {
    setActiveAction(action);
    setDraft(createInitialDraft(device, action));
    setSubmitError(null);
    setSubmitResult(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setActiveAction(null);
    setDraft(null);
    setSubmitError(null);
  };

  const handleSend = async () => {
    if (!selectedApp?.id || !selectedApp.appKey || !selectedDevice || !activeAction || !draft) {
      return;
    }

    setSending(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const payloadJson = draft.payloadJson.trim() ? JSON.parse(draft.payloadJson) : {};
      const cleanParameters = Object.fromEntries(
        Object.entries(draft.parameters).filter(([, value]) => value.trim())
      );

      const request: ExecuteCommandInput = {
        appId: selectedApp.id,
        appKey: selectedApp.appKey,
        deviceId: selectedDevice.device.id,
        commandKey: activeAction.key,
        installationId: draft.installationId.trim() || undefined,
        messageId: activeAction.messageId,
        topic: activeAction.topicTemplate ?? undefined,
        subTopic: activeAction.subTopic ?? undefined,
        parameters: cleanParameters,
        payload: payloadJson,
      };

      await deviceControlApi.executeClaimedCommand(request);
      setSubmitResult(`Action ${humanizeMessageLabel(activeAction)} sent successfully.`);
    } catch (sendError) {
      setSubmitError(sendError instanceof Error ? sendError.message : "Failed to send command");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="device-control-theme space-y-6">
      <div className="flow-module-hero overflow-hidden rounded-[32px] px-6 py-7 md:px-8">
        <div className="flow-module-hero__mesh" aria-hidden="true" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Device Control</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.055em] text-white md:text-[38px]">Action control panel</h1>
          <p className="mt-3 max-w-3xl text-[13px] leading-7 text-slate-300">
            Review claimed devices, inspect device-type topic actions, and configure the exact MQTT payload before dispatch.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[12px] text-slate-200 shadow-sm backdrop-blur-sm">
          {selectedApp ? `${selectedApp.name} selected` : "Select an application to begin"}
        </div>
      </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DeviceControlMetric
          icon={<ShieldCheck size={18} />}
          label="Trusted apps"
          value={String(metrics.trustedApps)}
          helper="Registered application consoles"
        />
        <DeviceControlMetric
          icon={<Cpu size={18} />}
          label="Claimed devices"
          value={String(metrics.claimedDevices)}
          helper="Devices available to the selected app"
        />
        <DeviceControlMetric
          icon={<Settings2 size={18} />}
          label="Available actions"
          value={String(metrics.configurableActions)}
          helper="Topics resolved from device communication policies"
        />
        <DeviceControlMetric
          icon={<Activity size={18} />}
          label="ELEVATE devices"
          value={String(metrics.elevateClaims)}
          helper="Claimed devices linked to ELEVATE families"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Claimed device registry</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Select an application, then choose a claimed device to reveal the messaging-policy topics available for control.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="min-w-[220px]">
                <span className="sr-only">Application</span>
                <select
                  value={selectedAppId}
                  onChange={(event) => setSelectedAppId(event.target.value)}
                  className="app-shell-select w-full px-4 text-[12.5px] text-slate-700 outline-none transition"
                >
                  <option value="">{appsLoading ? "Loading applications..." : "Select application"}</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="app-shell-search relative min-w-[260px] px-1">
                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search claimed devices"
                  className="app-shell-input h-11 w-full border-0 bg-transparent pl-10 pr-4 text-[12.5px] text-slate-700 shadow-none outline-none"
                />
              </label>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  {["Device", "Vendor", "Policy", "Actions", "Claimed", "Control"].map((label) => (
                    <th key={label} className="px-5 py-4 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devicesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-slate-500">
                      Loading claimed devices...
                    </td>
                  </tr>
                ) : profilesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-slate-500">
                      Resolving communication policies and topic actions...
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-slate-500">
                      No claimed devices available for this application yet.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((entry) => {
                    const catalog = parseCommandDefinitions(entry, catalogProfiles[entry.device.id]);
                    const isSelected = selectedDevice?.id === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        className={`motion-soft border-b border-slate-100 last:border-0 hover:bg-slate-50/70 ${
                          isSelected ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-[13px] font-medium text-slate-900">{entry.device.name}</p>
                            <p className="mt-1 text-[12px] text-slate-500">{entry.device.serialNumber ?? "-"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[12.5px] text-slate-600">{catalog.vendorName}</td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-[12.5px] font-medium text-slate-700">{catalog.communicationPolicy}</p>
                            <p className="mt-1 text-[11.5px] text-slate-500">{catalog.channels}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[12.5px] text-slate-600">{catalog.commands.length}</td>
                        <td className="px-5 py-4 text-[12.5px] text-slate-500">{formatDateTime(entry.claimedAt)}</td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedClaimId(entry.id)}
                            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                              isSelected
                                ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                            }`}
                          >
                            Open actions
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          {!selectedDevice || !selectedCatalog ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-700">Select a claimed device</p>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  The topic-based action list will appear here once a claimed device is selected.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Available actions</p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Messaging-policy topics for {selectedDevice.device.name}, resolved from its communication policy.
                </p>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Device</p>
                    <p className="mt-2 text-[14px] font-semibold text-slate-900">{selectedDevice.device.name}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{selectedDevice.device.serialNumber}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Vendor / Model</p>
                    <p className="mt-2 text-[14px] font-semibold text-slate-900">{selectedCatalog.vendorName}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{selectedCatalog.itemCode}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {selectedCatalog.commands.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-500">
                    No topic actions have been mapped for this device yet.
                  </div>
                ) : (
                  selectedCatalog.commands.map((action) => (
                    <div
                      key={`${action.messageId}-${action.key}`}
                      className="flex flex-col gap-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                            <Play size={14} />
                          </span>
                          <p className="text-[14px] font-semibold text-slate-900">{humanizeMessageLabel(action)}</p>
                          {action.messageType ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-medium text-slate-500">
                              {action.messageType}
                            </span>
                          ) : null}
                          {action.commandType ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-medium text-slate-500">
                              {action.commandType}
                            </span>
                          ) : null}
                          {action.subTopic ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-medium text-slate-500">
                              {action.subTopic}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11.5px] font-medium break-all text-slate-600">{action.topicTemplate ?? "-"}</p>
                        <p className="text-[12.5px] text-slate-500">{getActionDescription(action)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openActionDrawer(selectedDevice, action)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
                      >
                        <Settings2 size={14} />
                        Configure action
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </article>
      </div>

      <RightDrawer open={drawerOpen} onClose={closeDrawer} size="large">
        <div className="flex h-full flex-col bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <p className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                {activeAction ? humanizeMessageLabel(activeAction) : "Configure action"}
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Review the topic policy, fill parameter values, and send the resolved MQTT payload.
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
              aria-label="Close action drawer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!selectedDevice || !activeAction || !draft ? null : (
              <div className="space-y-5">
                <div className="grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Device</p>
                    <p className="mt-2 text-[14px] font-semibold text-slate-900">{selectedDevice.device.name}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{selectedDevice.device.serialNumber}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Installation</p>
                    <input
                      value={draft.installationId}
                      onChange={(event) =>
                        setDraft((current) => (current ? { ...current, installationId: event.target.value } : current))
                      }
                      placeholder="installation id"
                      className="app-shell-input mt-2 w-full px-4 text-[12.5px] text-slate-700 outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Topic</p>
                    <p className="mt-2 break-all text-[13px] font-medium text-slate-900">{activeAction.topicTemplate ?? "-"}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Message Type</p>
                      <p className="mt-2 text-[13px] font-medium text-slate-900">{activeAction.messageType ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Policy Type</p>
                      <p className="mt-2 text-[13px] font-medium text-slate-900">{activeAction.policyType ?? "-"}</p>
                    </div>
                  </div>
                </div>

                {collectParameterKeys(activeAction.payloadTemplate).length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[14px] font-semibold text-slate-900">Action parameters</p>
                      <p className="mt-1 text-[12.5px] text-slate-500">
                        These values fill the {"{{params.*}}"} placeholders defined in the messaging policy payload template.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(draft.parameters).map(([key, value]) => (
                        <label key={key} className="block space-y-1.5">
                          <span className="text-[12px] font-medium text-slate-600">{key}</span>
                          <input
                            value={value}
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      parameters: {
                                        ...current.parameters,
                                        [key]: event.target.value,
                                      },
                                    }
                                  : current
                              )
                            }
                            placeholder={`Enter ${key}`}
                            className="app-shell-input w-full px-4 text-[12.5px] text-slate-700 outline-none transition"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">Payload override</p>
                    <p className="mt-1 text-[12.5px] text-slate-500">
                      Edit the JSON payload if you need to override the default topic body.
                    </p>
                  </div>
                  <textarea
                    value={draft.payloadJson}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, payloadJson: event.target.value } : current))
                    }
                    rows={14}
                    className="app-shell-textarea w-full px-4 py-3 text-[12.5px] text-slate-700 outline-none transition"
                  />
                </div>

                {submitError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                    {submitError}
                  </p>
                ) : null}

                {submitResult ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
                    {submitResult}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-[12px] font-medium text-slate-600 transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !activeAction || !selectedDevice}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-[12px] font-medium text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={14} />
                {sending ? "Sending..." : "Send action"}
              </button>
            </div>
          </div>
        </div>
      </RightDrawer>
    </section>
  );
}
