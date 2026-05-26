import { ApiError } from "../../../middleware/error.middleware";
import {
  connectAdminClient,
  type ConnectAdminHttpError,
} from "../../iot-orchestration/connectAdmin.client";
import {
  renderPayloadTemplate,
  renderTopicTemplate,
} from "../../iot-orchestration/catalog-resolver";
import type {
  NormalizedTelemetryResult,
  ProtocolAdapter,
  ProtocolCommandRequest,
  ProtocolProvisionRequest,
  ProtocolSubscriptionRequest,
  RuntimeExecutionContext,
  TelemetryIngestRequest,
} from "../types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
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

function matchTopic(topic: string | undefined, template: string) {
  if (!topic) return false;
  const regex = new RegExp(
    `^${template
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\+|\\#/g, ".*")
      .replace(/\\\{\\\{[^}]+\\\}\\\}/g, "[^/]+")}$`,
    "i"
  );
  return regex.test(topic.trim());
}

function collectMetrics(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => [key, value as number])
  );
}

export const mqttAwsIotAdapter: ProtocolAdapter = {
  key: "mqtt-aws-iot",
  transports: ["mqtt", "aws-iot", "aws_iot"],

  async provision(context: RuntimeExecutionContext, request: ProtocolProvisionRequest) {
    return connectAdminClient.provisionThing(
      {
        deviceId: context.profile.device.serialNumber,
        thingName: request.thingName ?? context.thingName,
        thingTypeName: request.thingTypeName ?? context.profile.protocol.protocolName ?? context.profile.provisioning.deviceType,
        policyName: request.policyName ?? context.profile.provisioning.policyName,
        s3Prefix: request.s3Prefix ?? context.profile.provisioning.s3Prefix,
        channels: request.channels ?? context.profile.provisioning.channels,
        forceProvision: request.forceProvision ?? context.profile.provisioning.forceProvision,
        assetVersion: request.assetVersion,
        attributes: {
          ...context.profile.provisioning.attributes,
          ...(request.attributes ?? {}),
        },
        deviceType: request.deviceType ?? context.profile.provisioning.deviceType,
      },
      context.correlationId
    ) as Promise<Record<string, unknown>>;
  },

  async executeCommand(context: RuntimeExecutionContext, request: ProtocolCommandRequest) {
    const command = context.profile.commands.find((entry) => {
      if (request.messageId && entry.message.id === request.messageId) return true;
      return entry.key === request.commandKey.trim().toLowerCase();
    });

    if (!command) {
      throw new ApiError(404, `Command '${request.commandKey}' is not configured for this device`);
    }

    const resolvedTopic =
      getString(request.topic) ??
      renderTopicTemplate(command.topicTemplate, context.variables) ??
      "";
    const resolvedPayload = deepMerge(
      renderPayloadTemplate(command.payloadTemplate, {
        ...context.variables,
        params: request.parameters ?? {},
        payload: request.payload ?? {},
      }),
      request.payload ?? {}
    );

    if (!resolvedPayload.deviceid) {
      resolvedPayload.deviceid = context.profile.connectAdminDeviceId;
    }

    const subTopic = getString(request.subTopic) ?? command.subTopic;
    if (!subTopic) {
      throw new ApiError(
        400,
        `Unable to resolve MQTT sub-topic for command '${request.commandKey}'`
      );
    }

    const downstream = await connectAdminClient.publishToDevice(
      context.profile.connectAdminDeviceId,
      {
        subTopic,
        payload: resolvedPayload,
      },
      context.correlationId
    );

    return {
      success: true,
      command: {
        key: command.key,
        messageId: command.message.id,
        topic: resolvedTopic || `mqtt/device/${context.thingName}/${subTopic}`,
        subTopic,
      },
      payload: resolvedPayload,
      downstream,
    };
  },

  async subscribe(context: RuntimeExecutionContext, request: ProtocolSubscriptionRequest) {
    const explicitTopics = (request.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
    const messageTopics = context.telemetryProfiles
      .filter((profile) => !request.messageIds?.length || request.messageIds.includes(profile.messageId))
      .map((profile) => profile.resolvedTopic);

    const requestedTopics = Array.from(new Set([...explicitTopics, ...messageTopics]));
    if (requestedTopics.length === 0) {
      throw new ApiError(400, "No valid topics found to subscribe");
    }

    const downstream = await connectAdminClient.subscribeTopics(
      requestedTopics,
      context.correlationId
    );

    return {
      success: true,
      requestedTopics,
      downstream,
    };
  },

  async ingestTelemetry(
    context: RuntimeExecutionContext,
    request: TelemetryIngestRequest
  ): Promise<NormalizedTelemetryResult> {
    const payload = request.payload;
    const matchedTelemetry = context.telemetryProfiles.find((profile) =>
      matchTopic(request.topic, profile.topicTemplate) || matchTopic(request.topic, profile.resolvedTopic)
    );

    const matched = Boolean(matchedTelemetry);
    const expectedFields = matchedTelemetry?.expectedFields ?? [];
    const telemetry =
      expectedFields.length > 0
        ? Object.fromEntries(
            expectedFields
              .filter((field) => field in payload)
              .map((field) => [field, payload[field]])
          )
        : payload;

    const state: Record<string, unknown> = {
      status: payload.status ?? null,
      firmwareVersion: payload.firmware_version ?? payload.firmwareVersion ?? null,
      channels: payload.channels ?? null,
      lastSeenTopic: request.topic ?? null,
      receivedAt: request.receivedAt ?? new Date().toISOString(),
    };

    return {
      matched,
      matchedMessageId: matchedTelemetry?.messageId,
      category: matchedTelemetry ? "telemetry" : "unknown",
      parser: matchedTelemetry?.parser ?? "default",
      telemetry,
      state,
      metrics: collectMetrics(payload),
      raw: payload,
    };
  },
};
