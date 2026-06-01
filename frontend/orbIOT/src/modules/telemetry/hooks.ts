import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { telemetryApi } from "./api";
import type {
  TelemetryDeviceGroup,
  TelemetryDeviceRecord,
  TelemetryDirection,
  TelemetryFilters,
  TelemetryHealth,
  TelemetryLoadState,
  TelemetryLogEntry,
} from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseJsonObject(value: string | null | undefined) {
  if (!value || !value.trim()) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyPretty(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function inferDirection(category: string, topic: string): TelemetryDirection {
  const normalized = `${category} ${topic}`.toLowerCase();
  if (/(publish|command|control|shadow\/get)/.test(normalized)) return "outgoing";
  if (/(telemetry|update|status|reported|ingest|receive|subscribe)/.test(normalized)) return "incoming";
  return "unknown";
}

function normalizeHealth(value: unknown, fallbackError: boolean = false): TelemetryHealth {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (fallbackError || /(fault|error|failed)/.test(normalized)) return "error";
  if (/(connected|online|active|on)/.test(normalized)) return "connected";
  if (/(offline|disconnected|inactive|off)/.test(normalized)) return "disconnected";
  return "unknown";
}

function summarizePayload(payload: Record<string, unknown> | null, category: string) {
  if (!payload) return category ? `${category} event` : "Payload snapshot unavailable";
  const pairs = [
    typeof payload.status === "string" ? `status ${payload.status}` : "",
    typeof payload.switch_no === "string" ? `switch ${payload.switch_no}` : "",
    typeof payload.switchNo === "string" ? `switch ${payload.switchNo}` : "",
    typeof payload.channel === "string" ? `channel ${payload.channel}` : "",
    typeof payload.deviceid === "string" ? `device ${payload.deviceid}` : "",
  ].filter(Boolean);

  if (pairs.length > 0) return pairs.join(" • ");

  const firstEntry = Object.entries(payload)[0];
  if (!firstEntry) return category ? `${category} event` : "Empty payload";

  const [key, value] = firstEntry;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${key}: ${String(value)}`;
  }

  return category ? `${category} payload` : "Structured payload";
}

function extractErrorDetails(payload: Record<string, unknown> | null, runtime: Record<string, unknown>, log: Record<string, unknown>) {
  const candidates = [
    payload?.error,
    payload?.message,
    log.error,
    log.errorDetails,
    runtime.lastError,
  ];

  for (const candidate of candidates) {
    const value = readString(candidate);
    if (value) return value;
  }

  const protocolState =
    isPlainObject(runtime.lastProtocolState) ? (runtime.lastProtocolState as Record<string, unknown>) : {};
  const status = readString(protocolState.status);
  if (status.toLowerCase() === "fault") {
    return "Protocol state reported fault";
  }

  return null;
}

function sortLogsDescending(a: TelemetryLogEntry, b: TelemetryLogEntry) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function buildTelemetryGroup(record: TelemetryDeviceRecord): TelemetryDeviceGroup | null {
  const metadata = parseJsonObject(record.metadata);
  const runtime = isPlainObject(metadata.runtime) ? (metadata.runtime as Record<string, unknown>) : {};
  const protocolEngine = isPlainObject(metadata.protocolEngine)
    ? (metadata.protocolEngine as Record<string, unknown>)
    : {};
  const catalog = isPlainObject(metadata.catalog) ? (metadata.catalog as Record<string, unknown>) : {};
  const lastTelemetry = isPlainObject(runtime.lastTelemetry)
    ? (runtime.lastTelemetry as Record<string, unknown>)
    : null;
  const protocolState = isPlainObject(runtime.lastProtocolState)
    ? (runtime.lastProtocolState as Record<string, unknown>)
    : {};
  const logItems = Array.isArray(runtime.lastTelemetryLog)
    ? runtime.lastTelemetryLog.filter(isPlainObject)
    : [];

  const thingId =
    readString(runtime.thingId) ||
    readString(catalog.thingId) ||
    readString(record.foreignId) ||
    readString(record.serialNumber) ||
    record.id;
  const deviceName = readString(record.name) || readString(record.serialNumber) || record.id;
  const serialNumber = readString(record.serialNumber) || deviceName;
  const connectionType = readString(record.connectionType).toUpperCase() || "MQTT";
  const lastTelemetryAt = readString(runtime.lastTelemetryAt) || record.updatedAt || record.createdAt || new Date().toISOString();
  const latestTopic = readString(runtime.lastTelemetryTopic);
  const baseHealth = normalizeHealth(protocolState.status ?? record.status);
  const fallbackPayloadSummary = summarizePayload(lastTelemetry, readString(protocolState.status));

  const logs = logItems.map((log, index, arr) => {
    const at = readString(log.at) || lastTelemetryAt;
    const topic = readString(log.topic) || latestTopic;
    const category = readString(log.category) || "telemetry";
    const matchedMessageId = readString(log.matchedMessageId) || null;
    const isNewest = index === arr.length - 1;
    const payload = isNewest ? lastTelemetry : null;
    const payloadText = stringifyPretty(payload);
    const errorDetails = extractErrorDetails(payload, runtime, log);
    const connectionStatus = normalizeHealth(log.status ?? protocolState.status ?? record.status, Boolean(errorDetails));

    return {
      id: `${record.id}-${at}-${topic || "no-topic"}-${index}`,
      deviceId: record.id,
      deviceName,
      serialNumber,
      thingId,
      topic,
      payloadSummary: isNewest ? summarizePayload(payload, category) : `${category} • ${fallbackPayloadSummary}`,
      payload,
      payloadText,
      qos: readString(log.qos) || "—",
      timestamp: at,
      connectionStatus,
      direction: inferDirection(category, topic),
      messageType: category,
      errorDetails,
      matchedMessageId,
      brokerStatus: connectionStatus === "connected" ? "Broker accepted" : connectionStatus === "error" ? "Requires attention" : "Pending broker state",
      isNewest,
      rawLog: log,
      runtimeMetadata: runtime,
      deviceMetadata: metadata,
      thingMetadata: {
        thingId,
        topic,
        adapterKey: readString(protocolEngine.lastAdapterKey),
        matchedMessageId,
      },
    } satisfies TelemetryLogEntry;
  });

  if (logs.length === 0 && !lastTelemetry && !latestTopic) {
    return null;
  }

  if (logs.length === 0) {
    logs.push({
      id: `${record.id}-${lastTelemetryAt}-synthetic`,
      deviceId: record.id,
      deviceName,
      serialNumber,
      thingId,
      topic: latestTopic,
      payloadSummary: fallbackPayloadSummary,
      payload: lastTelemetry,
      payloadText: stringifyPretty(lastTelemetry),
      qos: "—",
      timestamp: lastTelemetryAt,
      connectionStatus: baseHealth,
      direction: "incoming",
      messageType: "telemetry",
      errorDetails: extractErrorDetails(lastTelemetry, runtime, {}),
      matchedMessageId: readString(protocolEngine.lastMatchedMessageId) || null,
      brokerStatus: baseHealth === "connected" ? "Broker accepted" : "Pending broker state",
      isNewest: true,
      rawLog: {},
      runtimeMetadata: runtime,
      deviceMetadata: metadata,
      thingMetadata: {
        thingId,
        topic: latestTopic,
        adapterKey: readString(protocolEngine.lastAdapterKey),
        matchedMessageId: readString(protocolEngine.lastMatchedMessageId) || null,
      },
    });
  }

  logs.sort(sortLogsDescending);

  return {
    id: record.id,
    label: deviceName,
    serialNumber,
    thingId,
    connectionStatus: logs[0]?.connectionStatus ?? baseHealth,
    connectionType,
    latestTopic: logs[0]?.topic ?? latestTopic,
    lastSeenAt: logs[0]?.timestamp ?? lastTelemetryAt,
    logCount: logs.length,
    errorCount: logs.filter((entry) => entry.connectionStatus === "error" || Boolean(entry.errorDetails)).length,
    messageTypes: Array.from(new Set(logs.map((entry) => entry.messageType))).filter(Boolean),
    logs,
  };
}

function isTelemetryGroup(value: TelemetryDeviceGroup | null): value is TelemetryDeviceGroup {
  return value !== null;
}

export function filterTelemetryLogs(groups: TelemetryDeviceGroup[], filters: TelemetryFilters, selectedDeviceId: string | null) {
  const search = filters.search.trim().toLowerCase();
  const topicFilter = filters.topic.trim().toLowerCase();
  const typeFilter = filters.messageType.trim().toLowerCase();
  const now = Date.now();
  const timeWindowMs =
    filters.timeRange === "1h"
      ? 60 * 60 * 1000
      : filters.timeRange === "24h"
        ? 24 * 60 * 60 * 1000
        : filters.timeRange === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : filters.timeRange === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : Number.POSITIVE_INFINITY;

  return groups
    .filter((group) => !selectedDeviceId || group.id === selectedDeviceId)
    .map((group) => {
      const logs = group.logs.filter((entry) => {
        const timestamp = new Date(entry.timestamp).getTime();
        const withinRange = Number.isFinite(timeWindowMs) ? now - timestamp <= timeWindowMs : true;
        const matchesTopic = topicFilter ? entry.topic.toLowerCase().includes(topicFilter) : true;
        const matchesStatus = filters.status === "all" ? true : entry.connectionStatus === filters.status;
        const matchesType = typeFilter ? entry.messageType.toLowerCase() === typeFilter : true;
        const matchesErrorOnly = filters.errorOnly ? Boolean(entry.errorDetails) || entry.connectionStatus === "error" : true;
        const haystack = [
          entry.deviceId,
          entry.deviceName,
          entry.serialNumber,
          entry.thingId,
          entry.topic,
          entry.payloadSummary,
          entry.payloadText,
        ]
          .join(" ")
          .toLowerCase();
        const matchesSearch = search ? haystack.includes(search) : true;

        return withinRange && matchesTopic && matchesStatus && matchesType && matchesErrorOnly && matchesSearch;
      });

      return {
        ...group,
        logs,
        logCount: logs.length,
        errorCount: logs.filter((entry) => entry.connectionStatus === "error" || Boolean(entry.errorDetails)).length,
      };
    })
    .filter((group) => group.logs.length > 0 || !selectedDeviceId);
}

export function useTelemetryLogs(pollingEnabled: boolean, intervalMs: number = 15000): TelemetryLoadState {
  const [groups, setGroups] = useState<TelemetryDeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    if (firstLoadRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);
    try {
      const devices = await telemetryApi.listDeviceTelemetry();
      const nextGroups = devices
        .map(buildTelemetryGroup)
        .filter(isTelemetryGroup)
        .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

      setGroups(nextGroups);
      setLastLoadedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load telemetry logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoadRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollingEnabled) return;
    const intervalId = window.setInterval(() => {
      void load();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, load, pollingEnabled]);

  return {
    groups,
    loading,
    error,
    refreshing,
    lastLoadedAt,
    reload: load,
  };
}

export function useTelemetryAnimations(groups: TelemetryDeviceGroup[]) {
  const previousIds = useRef<Set<string>>(new Set());

  return useMemo(() => {
    const nextIds = new Set<string>();
    const animatedIds = new Set<string>();

    groups.forEach((group) => {
      group.logs.forEach((log) => {
        nextIds.add(log.id);
        if (!previousIds.current.has(log.id)) {
          animatedIds.add(log.id);
        }
      });
    });

    previousIds.current = nextIds;
    return animatedIds;
  }, [groups]);
}
