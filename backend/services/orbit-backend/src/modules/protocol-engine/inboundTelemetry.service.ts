import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import { resolveCatalogProfile } from "../iot-orchestration/catalog-resolver";
import { adapterRegistry } from "./adapterRegistry";
import { createRuntimeExecutionContext } from "./runtime-context.service";
import type { TelemetryIngestRequest } from "./types";

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

function stringifyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function summarizeHealth(metrics: Record<string, number>, telemetry: Record<string, unknown>) {
  const scoreParts: number[] = [];
  if (typeof metrics.voltage === "number") scoreParts.push(100);
  if (typeof metrics.current === "number") scoreParts.push(100);
  if (typeof metrics.power === "number" || typeof metrics.unit === "number") scoreParts.push(100);
  if (typeof telemetry.status === "string" && telemetry.status.toLowerCase() === "fault") scoreParts.push(25);
  return scoreParts.length > 0
    ? Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)
    : null;
}

export const inboundTelemetryService = {
  async ingest(request: TelemetryIngestRequest) {
    const serialNumber = request.serialNumber.trim();
    const device = await prisma.device.findFirst({
      where: { serialNumber },
    });

    if (!device) {
      throw new ApiError(404, `Device with serialNumber '${serialNumber}' not found`);
    }

    const profile = await resolveCatalogProfile(device.id);
    const context = createRuntimeExecutionContext(profile, {
      params: {},
      payload: request.payload,
    });
    const adapter = adapterRegistry.resolve(context);

    if (!adapter.ingestTelemetry) {
      throw new ApiError(400, `Adapter '${adapter.key}' does not support telemetry ingestion`);
    }

    const normalized = await adapter.ingestTelemetry(context, request);
    const metadata = parseJsonObject(device.metadata);
    const runtime = isPlainObject(metadata.runtime) ? metadata.runtime : {};
    const telemetryLog = Array.isArray(runtime.lastTelemetryLog)
      ? runtime.lastTelemetryLog.slice(-9)
      : [];

    const nextRuntime = {
      ...runtime,
      lastTelemetryAt: request.receivedAt ?? new Date().toISOString(),
      lastTelemetryTopic: request.topic ?? null,
      lastTelemetry: normalized.telemetry,
      lastProtocolState: normalized.state,
      metrics: normalized.metrics,
      healthScore: summarizeHealth(normalized.metrics, normalized.telemetry),
      lastTelemetryLog: [
        ...telemetryLog,
        {
          at: request.receivedAt ?? new Date().toISOString(),
          topic: request.topic ?? null,
          category: normalized.category,
          matchedMessageId: normalized.matchedMessageId ?? null,
        },
      ],
    };

    const protocolEngine = isPlainObject(metadata.protocolEngine) ? metadata.protocolEngine : {};
    const updated = await prisma.device.update({
      where: { id: device.id },
      data: {
        metadata: stringifyJson({
          ...metadata,
          runtime: nextRuntime,
          protocolEngine: {
            ...protocolEngine,
            lastIngestedAt: request.receivedAt ?? new Date().toISOString(),
            lastAdapterKey: adapter.key,
            lastMatchedMessageId: normalized.matchedMessageId ?? null,
          },
        }),
        status:
          typeof normalized.state.status === "string" && normalized.state.status.trim()
            ? String(normalized.state.status)
            : device.status,
      },
    });

    return {
      success: true,
      deviceId: updated.id,
      serialNumber: updated.serialNumber,
      adapter: adapter.key,
      transport: context.transport,
      matched: normalized.matched,
      normalized,
      capabilities: context.capabilities,
    };
  },
};
