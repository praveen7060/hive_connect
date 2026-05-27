const DEFAULT_CONNECT_ADMIN_BASE_URL = "http://localhost:4000";
const baseUrl = (
  process.env.CONNECT_ADMIN_BASE_URL ?? DEFAULT_CONNECT_ADMIN_BASE_URL
).replace(/\/+$/, "");
const DEFAULT_CONNECT_ADMIN_TIMEOUT_MS = 15000;
const connectAdminTimeoutMs = (() => {
  const parsed = Number(process.env.CONNECT_ADMIN_TIMEOUT_MS ?? DEFAULT_CONNECT_ADMIN_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_CONNECT_ADMIN_TIMEOUT_MS;
})();
const DEFAULT_CONNECT_ADMIN_DOCUMENTS_TIMEOUT_MS = 45000;
const connectAdminDocumentsTimeoutMs = (() => {
  const parsed = Number(
    process.env.CONNECT_ADMIN_DOCUMENTS_TIMEOUT_MS ?? DEFAULT_CONNECT_ADMIN_DOCUMENTS_TIMEOUT_MS
  );
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_CONNECT_ADMIN_DOCUMENTS_TIMEOUT_MS;
})();

type RequestMethod = "GET" | "POST";

export class ConnectAdminHttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

type ProvisionRequest = {
  deviceId: string;
  deviceType?: string;
  thingName?: string;
  thingTypeName?: string;
  policyName?: string;
  attributes?: Record<string, string>;
  s3Prefix?: string;
  channels?: string;
  forceProvision?: boolean;
  assetVersion?: number;
};  

type ControlRequest = {
  status: string;
  switchNo?: string | number;
  channel?: string | number;
  switch_no?: string | number;
};

type PublishRequest = {
  subTopic: string;
  payload: Record<string, unknown>;
};

type RegisterDeviceRequest = {
  deviceId: string;
  deviceType: string;
  thingId?: string;
  channels?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  macAddress?: string;
};

type DeprovisionRequest = {
  thingName?: string;
  s3Prefix?: string;
  deleteS3Objects?: boolean;
  deleteDeviceRecord?: boolean;  
};

type DeviceDocumentsRequest = {
  thingName?: string;
  documentPaths?: {
    certificate?: string;
    privateKey?: string;
    publicKey?: string;
    metadata?: string;
  };
}; 

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
 
async function request<T>(
  path: string,
  method: RequestMethod,
  correlationId?: string,
  body?: unknown,
  timeoutMs: number = connectAdminTimeoutMs
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (correlationId) headers["x-correlation-id"] = correlationId;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ConnectAdminHttpError(
        504,
        `Connect-admin request timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await response.text();
  const parsed = raw ? tryParseJson(raw) : null;

  if (!response.ok) {
    const message = getErrorMessage(parsed, response.statusText);
    throw new ConnectAdminHttpError(response.status, message, parsed);
  }

  return parsed as T;
}
   
function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch  {
    return raw;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback || "Connect-admin request failed";
}

export const connectAdminClient = {
  registerDevice: (payload: RegisterDeviceRequest, correlationId?: string) =>
    request("/internal/devices/register", "POST", correlationId, payload),

  provisionThing: (payload: ProvisionRequest, correlationId?: string) =>
    request("/internal/devices/onboard", "POST", correlationId, payload),

  getDevice: (deviceId: string, correlationId?: string) =>
    request(`/internal/devices/${encodeURIComponent(deviceId)}`, "GET", correlationId),

  getProvisioningStatus: (deviceId: string, correlationId?: string) =>
    request(`/internal/devices/${encodeURIComponent(deviceId)}/provisioning`, "GET", correlationId),

  controlDevice: (deviceId: string, payload: ControlRequest, correlationId?: string) =>
    request(`/internal/devices/${encodeURIComponent(deviceId)}/control`, "POST", correlationId, payload),

  publishToDevice: (deviceId: string, payload: PublishRequest, correlationId?: string) =>
    request(`/internal/devices/${encodeURIComponent(deviceId)}/publish`, "POST", correlationId, payload),

  deprovisionDevice: (deviceId: string, payload: DeprovisionRequest, correlationId?: string) =>
    request(
      `/internal/devices/${encodeURIComponent(deviceId)}/deprovision`,
      "POST",
      correlationId,
      payload
    ),

  getDeviceDocuments: (deviceId: string, payload: DeviceDocumentsRequest, correlationId?: string) =>
    request(
      `/internal/devices/${encodeURIComponent(deviceId)}/documents`,
      "POST",
      correlationId,
      payload,
      connectAdminDocumentsTimeoutMs
    ),

  subscribeTopics: (topics: string[], correlationId?: string) =>
    request("/internal/iot/topics/subscribe", "POST", correlationId, { topics }),
};

export function getConnectAdminBaseUrl(): string {
  return baseUrl;
}
