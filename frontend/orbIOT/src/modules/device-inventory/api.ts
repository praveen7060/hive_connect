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
  resourcePath: string
): CrudApi<T, CreateInput, UpdateInput> {
  return {
    list: () => apiRequest<T[]>(`/${resourcePath}`, "GET"),
    getById: (id: EntityId) => apiRequest<T>(`/${resourcePath}/${id}`, "GET"),
    create: (payload: CreateInput) => apiRequest<T>(`/${resourcePath}`, "POST", payload),
    update: (id: EntityId, payload: UpdateInput) =>
      apiRequestWithFallback<T>(`/${resourcePath}/${id}`, "PATCH", "PUT", payload),
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
  devices: createCrudApi<any>("devices"),
  applicationConsoleApps: createCrudApi<any>("application-console/apps"),
  iot: {
    provisionThing: (payload: IotProvisionRequest) =>
      apiRequest<IotProvisionResponse>("/iot/things/provision", "POST", payload),
    getProvisioningStatus: (deviceId: string) =>
      apiRequest<any>(`/iot/devices/${encodeURIComponent(deviceId)}/provisioning`, "GET"),
    getDeviceDocuments: (deviceId: string, payload: { thingName?: string; documentPaths?: IotDocumentPaths }) =>
      apiRequest<IotDocumentsResponse>(
        `/iot/devices/${encodeURIComponent(deviceId)}/documents`,
        "POST",
        payload,
        MQTT_DOCS_TIMEOUT_MS
      ),
  },
  applicationConsole: {
    createEnrollmentQr: (deviceId: string | number, payload?: Record<string, unknown>) =>
      apiRequest<any>(
        `/application-console/devices/${encodeURIComponent(String(deviceId))}/enrollment-qrs`,
        "POST",
        payload ?? {}
      ),
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
};
