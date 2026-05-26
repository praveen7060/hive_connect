import type { CatalogProfile } from "../iot-orchestration/catalog-resolver";

export type ProtocolCapability = {
  key: string;
  label: string;
  category: "command" | "telemetry" | "provisioning" | "subscription" | "document";
  transport: string;
  messageId?: string;
  topic?: string;
  subTopic?: string;
  commandType?: string;
  parameters: string[];
  metadata: Record<string, unknown>;
};

export type TelemetryProfile = {
  messageId: string;
  name: string;
  topicTemplate: string;
  resolvedTopic: string;
  parser: string;
  expectedFields: string[];
  metadata: Record<string, unknown>;
};

export type RuntimeExecutionContext = {
  correlationId?: string;
  profile: CatalogProfile;
  thingId: string;
  thingName: string;
  transport: string;
  adapterKey: string;
  capabilities: ProtocolCapability[];
  telemetryProfiles: TelemetryProfile[];
  variables: Record<string, unknown>;
};

export type ProtocolProvisionRequest = {
  thingName?: string;
  thingTypeName?: string;
  policyName?: string;
  s3Prefix?: string;
  channels?: string;
  forceProvision?: boolean;
  attributes?: Record<string, string>;
  deviceType?: string;
  assetVersion?: number;
};

export type ProtocolCommandRequest = {
  commandKey: string;
  messageId?: string;
  topic?: string;
  subTopic?: string;
  parameters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type ProtocolSubscriptionRequest = {
  topics?: string[];
  messageIds?: string[];
};

export type TelemetryIngestRequest = {
  serialNumber: string;
  topic?: string;
  thingId?: string;
  vendorName?: string;
  source?: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
};

export type NormalizedTelemetryResult = {
  matched: boolean;
  matchedMessageId?: string;
  category: string;
  parser: string;
  telemetry: Record<string, unknown>;
  state: Record<string, unknown>;
  metrics: Record<string, number>;
  raw: Record<string, unknown>;
};

export interface ProtocolAdapter {
  readonly key: string;
  readonly transports: string[];
  provision?(
    context: RuntimeExecutionContext,
    request: ProtocolProvisionRequest
  ): Promise<Record<string, unknown>>;
  executeCommand(
    context: RuntimeExecutionContext,
    request: ProtocolCommandRequest
  ): Promise<Record<string, unknown>>;
  subscribe?(
    context: RuntimeExecutionContext,
    request: ProtocolSubscriptionRequest
  ): Promise<Record<string, unknown>>;
  ingestTelemetry?(
    context: RuntimeExecutionContext,
    request: TelemetryIngestRequest
  ): Promise<NormalizedTelemetryResult>;
}
