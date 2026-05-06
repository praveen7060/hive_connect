import type {
  CatalogProfileResponse,
  ClaimedDeviceRecord,
  ControlApplication,
  ExecuteCommandInput,
} from "./types";

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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function apiRequest<T>(
  path: string,
  method: "GET" | "POST",
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
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
      const details = [
        errorPayload.message,
        errorPayload.error,
        Array.isArray(errorPayload.errors) ? errorPayload.errors.join(", ") : null,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join(": ");
      if (details) {
        message = details;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const deviceControlApi = {
  listApps: () => apiRequest<ControlApplication[]>("/application-console/apps", "GET"),
  listClaimedDevices: (appId: string, appKey: string) =>
    apiRequest<ClaimedDeviceRecord[]>(`/application-console/apps/${encodeURIComponent(appId)}/devices`, "GET", {
      headers: {
        "x-app-key": appKey,
      },
    }),
  getCatalogProfile: (deviceId: string) =>
    apiRequest<CatalogProfileResponse>(`/iot/catalog/devices/${encodeURIComponent(deviceId)}/profile`, "GET"),
  executeClaimedCommand: ({
    appId,
    appKey,
    deviceId,
    commandKey,
    installationId,
    messageId,
    topic,
    subTopic,
    parameters,
    payload,
  }: ExecuteCommandInput) =>
    apiRequest<any>(
      `/application-console/apps/${encodeURIComponent(appId)}/devices/${encodeURIComponent(deviceId)}/commands/${encodeURIComponent(commandKey)}`,
      "POST",
      {
        headers: {
          "x-app-key": appKey,
        },
        body: {
          installationId,
          messageId,
          topic,
          subTopic,
          parameters,
          payload,
        },
      }
    ),
};
