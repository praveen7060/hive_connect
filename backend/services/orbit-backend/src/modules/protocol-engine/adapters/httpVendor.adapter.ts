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

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export const httpVendorAdapter: ProtocolAdapter = {
  key: "http-vendor",
  transports: ["http", "https", "rest"],

  async executeCommand(context: RuntimeExecutionContext, request: ProtocolCommandRequest) {
    const command = context.profile.commands.find((entry) => {
      if (request.messageId && entry.message.id === request.messageId) return true;
      return entry.key === request.commandKey.trim().toLowerCase();
    });

    if (!command) {
      throw new ApiError(404, `Command '${request.commandKey}' is not configured for this device`);
    }

    const vendorMetadata = parseJsonObject(context.profile.vendor?.description ?? undefined);
    const endpointBase =
      getString(context.profile.protocol.metadata.baseUrl) ??
      getString(vendorMetadata.baseUrl) ??
      getString(context.profile.vendor?.authorizationUrl);

    if (!endpointBase) {
      throw new ApiError(
        400,
        "HTTP vendor adapter requires a baseUrl in protocol metadata or vendor metadata"
      );
    }

    const route =
      getString(request.topic) ??
      renderTopicTemplate(command.topicTemplate, {
        ...context.variables,
        params: request.parameters ?? {},
        payload: request.payload ?? {},
      });

    const body = {
      ...renderPayloadTemplate(command.payloadTemplate, {
        ...context.variables,
        params: request.parameters ?? {},
        payload: request.payload ?? {},
      }),
      ...(request.payload ?? {}),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (context.profile.vendor?.apiToken) {
      headers.Authorization = `Bearer ${context.profile.vendor.apiToken}`;
    }

    const response = await fetch(`${endpointBase.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    const payload = raw ? (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    })() : null;

    if (!response.ok) {
      throw new ApiError(response.status, "Vendor HTTP command failed", payload);
    }

    return {
      success: true,
      transport: "http",
      route,
      body,
      response: payload,
    };
  },

  async subscribe(_context: RuntimeExecutionContext, _request: ProtocolSubscriptionRequest) {
    return {
      success: true,
      mode: "noop",
      message: "HTTP adapter does not maintain MQTT-style subscriptions",
    };
  },

  async ingestTelemetry(
    _context: RuntimeExecutionContext,
    request: TelemetryIngestRequest
  ): Promise<NormalizedTelemetryResult> {
    return {
      matched: true,
      category: "telemetry",
      parser: "http-default",
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
