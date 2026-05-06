export type PrimitiveValue = string | number | boolean | null;

export interface ControlApplication {
  id: string;
  name: string;
  domain?: string | null;
  applicationCode?: string | null;
  appKey?: string | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClaimedDeviceRecord {
  id: string;
  deviceId: string;
  appId: string;
  enrollmentQrId: string;
  installationId?: string | null;
  alias?: string | null;
  status?: string | null;
  metadata?: string | null;
  claimedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  device: {
    id: string;
    name: string;
    serialNumber?: string | null;
    connectionType?: string | null;
    project?: string | null;
    status?: string | null;
    metadata?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface CommandDefinition {
  key: string;
  messageId: string;
  name: string;
  commandType?: string | null;
  messageType?: string | null;
  policyType?: string | null;
  communicationMethod?: string | null;
  topicTemplate?: string | null;
  subTopic?: string;
  topicUnique?: boolean;
  isPayloadCentric?: boolean;
  payloadTemplate?: Record<string, unknown>;
  confirmationPayloadTemplate?: Record<string, unknown>;
}

export interface DeviceCatalogSummary {
  vendorName: string;
  itemCode: string;
  itemName: string;
  communicationPolicy: string;
  channels: string;
  thingId: string;
  connectAdminDeviceId: string;
  commands: CommandDefinition[];
}

export interface CatalogProfileResponse {
  device: {
    id: string;
    name: string;
    serialNumber?: string | null;
    connectionType?: string | null;
    project?: string | null;
    status?: string | null;
  };
  item?: {
    id: string;
    name: string;
    itemCode?: string | null;
    itemType?: string | null;
  } | null;
  communication?: {
    id: string;
    name: string;
    protocol?: string | null;
    version?: string | null;
    centric?: string | null;
    communicationMethod?: string | null;
    transport?: string | null;
    format?: string | null;
  } | null;
  thingId?: string | null;
  thingName?: string | null;
  connectAdminDeviceId: string;
  provisioning?: {
    channels?: string | null;
    thingName?: string | null;
    deviceType?: string | null;
  } | null;
  commands: CommandDefinition[];
  messages: Array<{
    id: string;
    name: string;
    topic: string;
    messageType?: string | null;
    commandType?: string | null;
    policyType?: string | null;
    communicationMethod?: string | null;
    topicUnique?: boolean;
    isPayloadCentric?: boolean;
    requestPayloadFormat?: string | null;
    responsePayloadFormat?: string | null;
  }>;
}

export interface ExecuteCommandInput {
  appId: string;
  appKey: string;
  deviceId: string;
  commandKey: string;
  installationId?: string;
  messageId?: string;
  topic?: string;
  subTopic?: string;
  parameters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}
