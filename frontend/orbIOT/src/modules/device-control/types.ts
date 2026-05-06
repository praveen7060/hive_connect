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
  subTopic?: string;
  payloadTemplate?: Record<string, unknown>;
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

export interface ExecuteCommandInput {
  appId: string;
  appKey: string;
  deviceId: string;
  commandKey: string;
  installationId?: string;
  parameters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}
