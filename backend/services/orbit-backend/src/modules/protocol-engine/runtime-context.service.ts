import {
  buildTemplateContext,
  resolveCatalogProfile,
  type CatalogProfile,
} from "../iot-orchestration/catalog-resolver";
import {
  deriveProtocolCapabilities,
  deriveTelemetryProfiles,
} from "./capability.service";
import type { RuntimeExecutionContext } from "./types";

export async function buildRuntimeExecutionContext(input: {
  deviceRecordId: string;
  correlationId?: string;
  params?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}): Promise<RuntimeExecutionContext> {
  const profile = await resolveCatalogProfile(input.deviceRecordId);
  return createRuntimeExecutionContext(profile, {
    correlationId: input.correlationId,
    params: input.params,
    payload: input.payload,
  });
}

export function createRuntimeExecutionContext(
  profile: CatalogProfile,
  input?: {
    correlationId?: string;
    params?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }
): RuntimeExecutionContext {
  const variables = buildTemplateContext(profile, input?.params ?? {}, input?.payload ?? {});
  return {
    correlationId: input?.correlationId,
    profile,
    thingId: profile.thingId ?? profile.provisioning.thingName,
    thingName: profile.thingName ?? profile.provisioning.thingName,
    transport: profile.protocol.transport,
    adapterKey: profile.protocol.adapterKey,
    capabilities: deriveProtocolCapabilities(profile),
    telemetryProfiles: deriveTelemetryProfiles(profile),
    variables,
  };
}
