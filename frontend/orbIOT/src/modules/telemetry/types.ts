export type PrimitiveTelemetryValue = string | number | boolean | null;

export type TelemetryDirection = "incoming" | "outgoing" | "unknown";
export type TelemetryHealth = "connected" | "disconnected" | "error" | "unknown";
export type TelemetryTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

export interface TelemetryDeviceRecord {
  id: string;
  name: string;
  serialNumber?: string | null;
  foreignId?: string | null;
  connectionType?: string | null;
  project?: string | null;
  status?: string | null;
  metadata?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface TelemetryThingMetadata {
  thingId: string;
  topic?: string;
  adapterKey?: string;
  matchedMessageId?: string | null;
}

export interface TelemetryLogEntry {
  id: string;
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  thingId: string;
  topic: string;
  payloadSummary: string;
  payload: Record<string, unknown> | null;
  payloadText: string;
  qos: string;
  timestamp: string;
  connectionStatus: TelemetryHealth;
  direction: TelemetryDirection;
  messageType: string;
  errorDetails: string | null;
  matchedMessageId: string | null;
  brokerStatus: string;
  isNewest: boolean;
  rawLog: Record<string, unknown>;
  runtimeMetadata: Record<string, unknown>;
  deviceMetadata: Record<string, unknown>;
  thingMetadata: TelemetryThingMetadata;
}

export interface TelemetryDeviceGroup {
  id: string;
  label: string;
  serialNumber: string;
  thingId: string;
  connectionStatus: TelemetryHealth;
  connectionType: string;
  latestTopic: string;
  lastSeenAt: string;
  logCount: number;
  errorCount: number;
  messageTypes: string[];
  logs: TelemetryLogEntry[];
}

export interface TelemetryFilters {
  search: string;
  topic: string;
  status: "all" | TelemetryHealth;
  messageType: string;
  timeRange: TelemetryTimeRange;
  errorOnly: boolean;
}

export interface TelemetryLoadState {
  groups: TelemetryDeviceGroup[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  lastLoadedAt: string | null;
  reload: () => Promise<void>;
}
