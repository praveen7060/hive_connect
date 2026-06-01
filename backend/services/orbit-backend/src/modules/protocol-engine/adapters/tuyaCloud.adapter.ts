import { createHash, createHmac } from "crypto";
import { ApiError } from "../../../middleware/error.middleware";
import {
  renderPayloadTemplate,
  renderTopicTemplate,
} from "../../iot-orchestration/catalog-resolver";
import type {
  NormalizedTelemetryResult,
  ProtocolAdapter,
  ProtocolCommandRequest,
  ProtocolSubscriptionRequest,
  RuntimeExecutionContext,
  TelemetryIngestRequest,
} from "../types";

type TuyaTokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tuyaTokenCache = new Map<string, TuyaTokenCacheEntry>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key] as Record<string, unknown>, value);
      continue;
    }
    merged[key] = value;
  }

  return merged as T;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256Upper(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex").toUpperCase();
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function buildSignedHeaders(input: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  method: string;
  pathWithQuery: string;
  body: string;
  timestamp: string;
}) {
  const bodyHash = sha256Hex(input.body);
  const stringToSign = `${input.method}\n${bodyHash}\n\n${input.pathWithQuery}`;
  const signPayload = `${input.clientId}${input.accessToken ?? ""}${input.timestamp}${stringToSign}`;
  const sign = hmacSha256Upper(signPayload, input.clientSecret);

  const headers: Record<string, string> = {
    client_id: input.clientId,
    t: input.timestamp,
    sign,
    sign_method: "HMAC-SHA256",
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (input.accessToken) {
    headers.access_token = input.accessToken;
  }

  return headers;
}

function extractTuyaConfig(context: RuntimeExecutionContext) {
  const vendor = context.profile.vendor;
  const protocolMetadata = context.profile.protocol.metadata;
  const vendorMetadata = parseJsonObject(vendor?.description ?? undefined);

  const clientId =
    getString(protocolMetadata.clientId) ??
    getString(vendorMetadata.clientId) ??
    getString(vendor?.clientId);
  const clientSecret =
    getString(protocolMetadata.clientSecret) ??
    getString(vendorMetadata.clientSecret) ??
    getString(vendor?.clientSecret);
  const baseUrl =
    getString(protocolMetadata.baseUrl) ??
    getString(vendorMetadata.baseUrl) ??
    getString(vendor?.authorizationUrl) ??
    "https://openapi.tuyain.com";

  if (!clientId || !clientSecret) {
    throw new ApiError(
      400,
      "Tuya adapter requires vendor clientId and clientSecret"
    );
  }

  return {
    vendorCacheKey: vendor?.id ?? vendor?.name ?? clientId,
    clientId,
    clientSecret,
    baseUrl: normalizeBaseUrl(baseUrl),
  };
}

async function fetchTuyaToken(config: {
  vendorCacheKey: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}) {
  const cached = tuyaTokenCache.get(config.vendorCacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  const pathWithQuery = "/v1.0/token?grant_type=1";
  const method = "GET";
  const timestamp = String(Date.now());
  const headers = buildSignedHeaders({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    method,
    pathWithQuery,
    body: "",
    timestamp,
  });

  const response = await fetch(`${config.baseUrl}${pathWithQuery}`, {
    method,
    headers,
  });
  const raw = await response.text();
  const payload = raw
    ? (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return { raw };
        }
      })()
    : {};

  if (!response.ok) {
    throw new ApiError(response.status, "Tuya token request failed", payload);
  }

  const result = isPlainObject(payload) && isPlainObject(payload.result) ? payload.result : {};
  const success = isPlainObject(payload) ? payload.success : false;
  const accessToken = getString(result.access_token);
  const expiresInSeconds = Number(result.expire_time ?? 3600);
  if (!success || !accessToken) {
    throw new ApiError(502, "Tuya token response did not include access_token", payload);
  }

  const expiresAt = Date.now() + Math.max(60, (Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) - 60) * 1000;
  tuyaTokenCache.set(config.vendorCacheKey, {
    token: accessToken,
    expiresAt,
  });

  return accessToken;
}

function resolveRoute(
  context: RuntimeExecutionContext,
  request: ProtocolCommandRequest,
  commandTopicTemplate: string,
  fallbackDeviceId: string
) {
  const route =
    getString(request.topic) ??
    renderTopicTemplate(commandTopicTemplate, context.variables);

  if (route?.startsWith("mqtt/")) {
    throw new ApiError(
      400,
      "MQTT topic configured for Tuya API device. Use HTTP route like /v1.0/iot-03/devices/{{connectAdminDeviceId}}/commands."
    );
  }

  return route || `/v1.0/iot-03/devices/${encodeURIComponent(fallbackDeviceId)}/commands`;
}

function normalizePayload(
  context: RuntimeExecutionContext,
  command: { payloadTemplate: Record<string, unknown>; key: string },
  request: ProtocolCommandRequest
) {
  const payload = deepMerge(
    renderPayloadTemplate(command.payloadTemplate, {
      ...context.variables,
      params: request.parameters ?? {},
      payload: request.payload ?? {},
    }),
    request.payload ?? {}
  );

  const commands = payload.commands;
  if (!Array.isArray(commands)) {
    const statusRaw = String(payload.status ?? "").trim().toLowerCase();
    if (statusRaw) {
      const switchNo = String(payload.switchNo ?? payload.switch_no ?? "1").trim();
      payload.commands = [
        {
          code: `switch_${switchNo || "1"}`,
          value: ["on", "true", "1", "start"].includes(statusRaw),
        },
      ];
    } else if (command.key.includes("turn_on")) {
      payload.commands = [{ code: "switch_1", value: true }];
    } else if (command.key.includes("turn_off")) {
      payload.commands = [{ code: "switch_1", value: false }];
    }
  }

  // Tuya /commands expects a strict payload shape: { commands: [{ code, value }] }
  // Avoid sending additional root keys that may trigger parameter validation errors.
  if (Array.isArray(payload.commands)) {
    payload.commands = payload.commands
      .filter((entry) => isPlainObject(entry))
      .map((entry) => ({
        code: String((entry as Record<string, unknown>).code ?? "").trim(),
        value: (entry as Record<string, unknown>).value,
      }))
      .filter((entry) => Boolean(entry.code));

    return { commands: payload.commands };
  }

  return payload;
}

export const tuyaCloudAdapter: ProtocolAdapter = {
  key: "tuya-cloud",
  transports: ["api", "http", "https", "rest", "tuya"],

  async executeCommand(context: RuntimeExecutionContext, request: ProtocolCommandRequest) {
    const command = context.profile.commands.find((entry) => {
      if (request.messageId && entry.message.id === request.messageId) return true;
      return entry.key === request.commandKey.trim().toLowerCase();
    });

    if (!command) {
      throw new ApiError(404, `Command '${request.commandKey}' is not configured for this device`);
    }

    const config = extractTuyaConfig(context);
    const accessToken = await fetchTuyaToken(config);
    const route = resolveRoute(
      context,
      request,
      command.topicTemplate,
      context.profile.connectAdminDeviceId
    );
    const payload = normalizePayload(context, command, request);

    const method = "POST";
    const body = JSON.stringify(payload);
    const targetUrl = route.startsWith("http://") || route.startsWith("https://")
      ? new URL(route)
      : new URL(`${config.baseUrl}${route.startsWith("/") ? route : `/${route}`}`);
    const pathWithQuery = `${targetUrl.pathname}${targetUrl.search}`;
    const timestamp = String(Date.now());
    const headers = buildSignedHeaders({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      accessToken,
      method,
      pathWithQuery,
      body,
      timestamp,
    });

    const response = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
    });

    const raw = await response.text();
    const downstream = raw
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return { raw };
          }
        })()
      : {};

    if (!response.ok) {
      throw new ApiError(response.status, "Tuya command request failed", downstream);
    }

    if (isPlainObject(downstream) && downstream.success === false) {
      throw new ApiError(502, "Tuya command rejected", downstream);
    }

    return {
      success: true,
      transport: "tuya-cloud",
      route: pathWithQuery,
      payload,
      downstream,
    };
  },

  async subscribe(_context: RuntimeExecutionContext, _request: ProtocolSubscriptionRequest) {
    return {
      success: true,
      mode: "noop",
      message: "Tuya cloud adapter does not support MQTT subscriptions from this endpoint.",
    };
  },

  async ingestTelemetry(
    _context: RuntimeExecutionContext,
    request: TelemetryIngestRequest
  ): Promise<NormalizedTelemetryResult> {
    return {
      matched: true,
      category: "telemetry",
      parser: "tuya-default",
      telemetry: request.payload,
      state: {
        receivedAt: request.receivedAt ?? new Date().toISOString(),
      },
      metrics: Object.fromEntries(
        Object.entries(request.payload).filter(([, value]) => typeof value === "number")
      ) as Record<string, number>,
      raw: request.payload,
    };
  },
};
