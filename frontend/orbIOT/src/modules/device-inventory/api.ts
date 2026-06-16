const ENV_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined);
const API_BASE_URL = ENV_API_BASE?.trim() ? ENV_API_BASE : "http://localhost:4001/api";
const DEFAULT_API_TIMEOUT_MS = 15000;
const API_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_API_TIMEOUT_MS as string | undefined;
  const parsed = Number(raw ?? DEFAULT_API_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_API_TIMEOUT_MS;
})();
const DEFAULT_MQTT_DOCS_TIMEOUT_MS = 45000;
const MQTT_DOCS_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_MQTT_DOCS_TIMEOUT_MS as string | undefined;
  const parsed = Number(raw ?? DEFAULT_MQTT_DOCS_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MQTT_DOCS_TIMEOUT_MS;
})();
const DEFAULT_DEVICE_ONBOARDING_TIMEOUT_MS = 90000;
const DEVICE_ONBOARDING_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_DEVICE_ONBOARDING_TIMEOUT_MS as string | undefined;
  const parsed = Number(raw ?? DEFAULT_DEVICE_ONBOARDING_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DEVICE_ONBOARDING_TIMEOUT_MS;
})();

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type FallbackHttpMethod = "PUT" | "PATCH";
export type EntityId = string | number;

export interface CrudApi<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  list: () => Promise<T[]>;
  getById: (id: EntityId) => Promise<T>;
  create: (payload: CreateInput) => Promise<T>;
  update: (id: EntityId, payload: UpdateInput) => Promise<T>;
  remove: (id: EntityId) => Promise<void>;
}

export type DeviceType = string;

export interface IotProvisionRequest {
  deviceId: string;
  deviceType?: DeviceType;
  thingName?: string;
  thingTypeName?: string;
  policyName?: string;
  attributes?: Record<string, string>;
  s3Prefix?: string;
  channels?: string;
  forceProvision?: boolean;
}

export interface IotProvisionResponse {
  success: boolean;
  reused: boolean;
  device: {
    deviceId: string;
    deviceType: DeviceType;
    thingId?: string | null;
  };
  provisioning: null | {
    thingName: string;
    thingTypeName: string | null;
    certificateId: string;
    certificateArn: string;
    region: string;
    bucket: string;
    policyAttached: string | null;
    s3Keys: {
      certificate: string;
      privateKey: string;
      publicKey: string;
      metadata: string;
    };
  };
}

export interface IotDocumentPaths {
  certificate?: string;
  privateKey?: string;
  publicKey?: string;
  metadata?: string;
}

export interface IotDocumentsResponse {
  success: boolean;
  deviceId: string;
  thingName?: string | null;
  region: string;
  documents: {
    certificate: string | null;
    privateKey: string | null;
    publicKey: string | null;
    metadata: string | null;
  };
  sources: {
    certificate: string | null;
    privateKey: string | null;
    publicKey: string | null;
    metadata: string | null;
  };
}

export interface CatalogCommandDefinition {
  key: string;
  messageId: string;
  name: string;
  commandType?: string | null;
  messageType?: string | null;
  policyType?: string | null;
  communicationMethod?: string | null;
  topicTemplate?: string | null;
  subTopic?: string | null;
  topicUnique?: boolean;
  isPayloadCentric?: boolean;
  payloadTemplate?: Record<string, unknown>;
  confirmationPayloadTemplate?: Record<string, unknown>;
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
  commands: CatalogCommandDefinition[];
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

export interface ExecuteCatalogCommandInput {
  messageId?: string;
  payload?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  topic?: string;
  subTopic?: string;
}

export interface IotControlRequest {
  status: string;
  switchNo?: string | number;
  channel?: string | number;
  switch_no?: string | number;
}

export interface IotPublishRequest {
  subTopic: string;
  payload: Record<string, unknown>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function apiRequest<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  timeoutMs: number = API_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorPayload = (await response.json()) as Record<string, unknown>;
      const explicitMessage = errorPayload?.message;
      const detailCandidates = [
        errorPayload?.details,
        errorPayload?.errors,
        errorPayload?.error,
      ];

      const normalizedPrimaryMessage = Array.isArray(explicitMessage)
        ? explicitMessage.join(", ")
        : typeof explicitMessage === "string"
          ? explicitMessage
          : "";

      const normalizedDetails = detailCandidates
        .flatMap((candidate) => {
          if (Array.isArray(candidate)) {
            return candidate
              .map((entry) => {
                if (typeof entry === "string") return entry;
                if (entry && typeof entry === "object") {
                  const values = Object.values(entry as Record<string, unknown>).filter(
                    (value) => typeof value === "string"
                  ) as string[];
                  return values.join(" ");
                }
                return "";
              })
              .filter(Boolean);
          }
          if (typeof candidate === "string") return [candidate];
          if (candidate && typeof candidate === "object") {
            return Object.entries(candidate as Record<string, unknown>)
              .map(([key, value]) => {
                if (value === null || value === undefined) return "";
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                  return `${key}: ${String(value)}`;
                }
                return "";
              })
              .filter(Boolean);
          }
          return [];
        })
        .join(", ");

      if (normalizedPrimaryMessage && normalizedDetails) {
        message = `${normalizedPrimaryMessage}: ${normalizedDetails}`;
      } else if (normalizedPrimaryMessage) {
        message = normalizedPrimaryMessage;
      } else if (normalizedDetails) {
        message = normalizedDetails;
      }
    } catch {
      // ignore JSON parse failures and keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function uploadFormRequest<T>(path: string, formData: FormData): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${API_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorPayload = (await response.json()) as Record<string, unknown>;
      if (typeof errorPayload.message === "string" && errorPayload.message.trim()) {
        message = errorPayload.message;
      } else if (typeof errorPayload.error === "string" && errorPayload.error.trim()) {
        message = errorPayload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function apiRequestWithFallback<T>(
  path: string,
  primaryMethod: FallbackHttpMethod,
  fallbackMethod: FallbackHttpMethod,
  body?: unknown,
  timeoutMs?: number
): Promise<T> {
  try {
    return await apiRequest<T>(path, primaryMethod, body, timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      message.includes("(404)") || message.includes("(405)") || message.includes("(501)");

    if (!shouldFallback) {
      throw error;
    }

    return apiRequest<T>(path, fallbackMethod, body, timeoutMs);
  }
}

function createCrudApi<T, CreateInput = Partial<T>, UpdateInput = Partial<T>>(
  resourcePath: string,
  options?: { createTimeoutMs?: number; updateTimeoutMs?: number }
): CrudApi<T, CreateInput, UpdateInput> {
  return {
    list: () => apiRequest<T[]>(`/${resourcePath}`, "GET"),
    getById: (id: EntityId) => apiRequest<T>(`/${resourcePath}/${id}`, "GET"),
    create: (payload: CreateInput) =>
      apiRequest<T>(`/${resourcePath}`, "POST", payload, options?.createTimeoutMs),
    update: (id: EntityId, payload: UpdateInput) =>
      apiRequestWithFallback<T>(
        `/${resourcePath}/${id}`,
        "PATCH",
        "PUT",
        payload,
        options?.updateTimeoutMs
      ),
    remove: (id: EntityId) => apiRequest<void>(`/${resourcePath}/${id}`, "DELETE"),
  };
}

export const deviceInventoryApi = {
  vendors: createCrudApi<any>("vendors"),
  parameters: createCrudApi<any>("parameters"),
  itemTypes: createCrudApi<any>("item-types"),
  communications: createCrudApi<any>("communications"),
  messages: createCrudApi<any>("messages"),
  items: createCrudApi<any>("items"),
  devices: createCrudApi<any>("devices", {
    createTimeoutMs: DEVICE_ONBOARDING_TIMEOUT_MS,
    updateTimeoutMs: DEVICE_ONBOARDING_TIMEOUT_MS,
  }),
  applicationConsoleApps: createCrudApi<any>("application-console/apps"),
  iot: {
    provisionThing: (payload: IotProvisionRequest) =>
      apiRequest<IotProvisionResponse>("/iot/things/provision", "POST", payload),
    getDevice: (deviceId: string) =>
      apiRequest<any>(`/iot/devices/${encodeURIComponent(deviceId)}`, "GET"),
    getProvisioningStatus: (deviceId: string) =>
      apiRequest<any>(`/iot/devices/${encodeURIComponent(deviceId)}/provisioning`, "GET"),
    controlDevice: (deviceId: string, payload: IotControlRequest) =>
      apiRequest<any>(`/iot/devices/${encodeURIComponent(deviceId)}/control`, "POST", payload),
    publishToDevice: (deviceId: string, payload: IotPublishRequest) =>
      apiRequest<any>(`/iot/devices/${encodeURIComponent(deviceId)}/publish`, "POST", payload),
    getDeviceDocuments: (deviceId: string, payload: { thingName?: string; documentPaths?: IotDocumentPaths }) =>
      apiRequest<IotDocumentsResponse>(
        `/iot/devices/${encodeURIComponent(deviceId)}/documents`,
        "POST",
        payload,
        MQTT_DOCS_TIMEOUT_MS
      ),
    getCatalogProfile: (deviceId: string) =>
      apiRequest<CatalogProfileResponse>(
        `/iot/catalog/devices/${encodeURIComponent(deviceId)}/profile`,
        "GET"
      ),
    executeCatalogCommand: (
      deviceId: string,
      commandKey: string,
      payload: ExecuteCatalogCommandInput
    ) =>
      apiRequest<any>(
        `/iot/catalog/devices/${encodeURIComponent(deviceId)}/commands/${encodeURIComponent(commandKey)}`,
        "POST",
        payload
      ),
  },
  applicationConsole: {
    createEnrollmentQr: (deviceId: string | number, payload?: Record<string, unknown>) =>
      apiRequest<any>(
        `/application-console/devices/${encodeURIComponent(String(deviceId))}/enrollment-qrs`,
        "POST",
        payload ?? {}
      ),
    createLinkQr: (appId: string | number, payload?: Record<string, unknown>) =>
      apiRequest<any>(
        `/application-console/apps/${encodeURIComponent(String(appId))}/link-qrs`,
        "POST",
        payload ?? {}
      ),
    claimLinkQr: (payload: Record<string, unknown>) =>
      apiRequest<any>("/application-console/link-accounts/claim", "POST", payload),
  },
  parameterImports: {
    importPdf: (file: File, vendor: string, persist: boolean = true) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vendor", vendor);
      formData.append("persist", String(persist));
      return uploadFormRequest<{
        vendor: string;
        fileName: string;
        extractedCount: number;
        savedCount: number;
        skippedCount: number;
        extracted: Array<{ name: string; variableType: string; sampleValue?: string; isConstant: boolean }>;
        skipped: string[];
      }>("/parameters/import-document", formData);
    },
  },
  vendorImports: {
    importPostman: (file: File, vendorName?: string, persist: boolean = true) => {
      const formData = new FormData();
      formData.append("file", file);
      if (vendorName?.trim()) {
        formData.append("vendorName", vendorName.trim());
      }
      formData.append("persist", String(persist));
      return uploadFormRequest<{
        vendorName: string;
        authType: string;
        baseUrl?: string;
        tokenUrl?: string;
        persisted: boolean;
        parameters: Array<{
          name: string;
          variableType: string;
          sampleValue?: string;
          isConstant: boolean;
          scope: string;
        }>;
        requests: Array<{
          name: string;
          method: string;
          path: string;
        }>;
        summary?: {
          parameterCreated: number;
          parameterUpdated: number;
          messageCreated: number;
          messageUpdated: number;
          requestCount: number;
          parameterCount: number;
        };
      }>("/vendors/import-postman", formData);
    },
  },
};
