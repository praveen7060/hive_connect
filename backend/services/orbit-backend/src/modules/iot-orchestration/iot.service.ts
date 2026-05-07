import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import {
  ConnectAdminHttpError,
  connectAdminClient,
  getConnectAdminBaseUrl,
} from "./connectAdmin.client";
import {
  buildTemplateContext,
  renderPayloadTemplate,
  renderTopicTemplate,
  resolveCatalogProfile,
} from "./catalog-resolver";
import {
  catalogExecuteCommandSchema,
  catalogProvisionSchema,
  catalogSubscriptionSchema,
  controlDeviceSchema,
  deviceDocumentsSchema,
  provisionThingSchema,
  publishDeviceSchema,
  subscribeTopicsSchema,
} from "./iot.schema";
import type { z } from "zod";

type ProvisionThingInput = z.infer<typeof provisionThingSchema>;
type ControlDeviceInput = z.infer<typeof controlDeviceSchema>;
type PublishDeviceInput = z.infer<typeof publishDeviceSchema>;
type SubscribeTopicsInput = z.infer<typeof subscribeTopicsSchema>;
type DeviceDocumentsInput = z.infer<typeof deviceDocumentsSchema>;
type CatalogProvisionInput = z.infer<typeof catalogProvisionSchema>;
type CatalogExecuteCommandInput = z.infer<typeof catalogExecuteCommandSchema>;
type CatalogSubscriptionInput = z.infer<typeof catalogSubscriptionSchema>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(
        merged[key] as Record<string, unknown>,
        value
      );
      continue;
    }

    merged[key] = value;
  }

  return merged as T;
}

function mergeIotMetadata(
  existingMetadata: string | null,
  iotMetadata: Record<string, unknown>
) {
  const base = (() => {
    if (!existingMetadata) return {};

    try {
      const parsed = JSON.parse(existingMetadata);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  })();

  return JSON.stringify(
    {
      ...base,
      iot: {
        ...(isPlainObject(base.iot) ? base.iot : {}),
        ...iotMetadata,
        updatedAt: new Date().toISOString(),
      },
    },
    null,
    2
  );
}

function isConnectAdminUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const primary = error.message ?? "";
  const cause =
    typeof (error as { cause?: unknown }).cause === "object" &&
    (error as { cause?: { message?: unknown } }).cause !== null
      ? String((error as { cause?: { message?: unknown } }).cause?.message ?? "")
      : "";
  const details = `${primary} ${cause}`.toLowerCase();

  return (
    details.includes("fetch failed") ||
    details.includes("econnrefused") ||
    details.includes("enotfound") ||
    details.includes("etimedout") ||
    details.includes("socket hang up")
  );
}

function throwMappedError(error: unknown): never {
  if (error instanceof ConnectAdminHttpError) {
    throw new ApiError(error.statusCode, error.message, error.details);
  }
  if (error instanceof ApiError) {
    throw error;
  }
  if (isConnectAdminUnavailableError(error)) {
    throw new ApiError(
      503,
      `Connect-admin service is unavailable. Ensure connect-admin is running on ${getConnectAdminBaseUrl()}.`
    );
  }
  throw new ApiError(500, "Internal orchestration failure");
}

function mapConnectAdminDeviceType(deviceType: string | undefined) {
  const normalized = (deviceType ?? "").trim().toLowerCase();

  if (normalized.includes("switch_4ch")) {
    return "SWITCH_4CH";
  }

  if (normalized.includes("dongle")) {
    return "DONGLE_2CH";
  }

  if (normalized.includes("smart_meter")) {
    return "SMART_METER";
  }

  return "GENERIC";
}

async function ensureConnectAdminRegistrationForProfile(
  profile: Awaited<ReturnType<typeof resolveCatalogProfile>>,
  correlationId?: string
) {
  try {
    await connectAdminClient.registerDevice(
      {
        deviceId: profile.device.serialNumber,
        deviceType: mapConnectAdminDeviceType(profile.provisioning.deviceType),
        thingId: profile.thingId ?? profile.provisioning.thingName,
        channels: profile.provisioning.channels,
        firmwareVersion: getString(profile.iotMetadata.firmwareVersion) ?? undefined,
      },
      correlationId
    );
  } catch (error) {
    throwMappedError(error);
  }
}

export const iotService = {
  async provisionThing(input: ProvisionThingInput, correlationId?: string) {
    try {
      return await connectAdminClient.provisionThing(input, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async getDevice(deviceId: string, correlationId?: string) {
    try {
      return await connectAdminClient.getDevice(deviceId, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async getProvisioningStatus(deviceId: string, correlationId?: string) {
    try {
      return await connectAdminClient.getProvisioningStatus(deviceId, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async controlDevice(deviceId: string, input: ControlDeviceInput, correlationId?: string) {
    try {
      return await connectAdminClient.controlDevice(deviceId, input, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async publishToDevice(deviceId: string, input: PublishDeviceInput, correlationId?: string) {
    try {
      return await connectAdminClient.publishToDevice(deviceId, input, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async getDeviceDocuments(deviceId: string, input: DeviceDocumentsInput, correlationId?: string) {
    try {
      return await connectAdminClient.getDeviceDocuments(deviceId, input, correlationId);
    } catch (error) {
      throwMappedError(error);
    }
  },

  async subscribeTopics(input: SubscribeTopicsInput, correlationId?: string) {
    const explicitTopics = (input.topics ?? []).map((topic) => topic.trim()).filter(Boolean);

    const messageIds = input.messageIds ?? [];
    const messageTopics = messageIds.length
      ? await prisma.message.findMany({
          where: { id: { in: messageIds } },
          select: { id: true, topic: true },
        })
      : [];

    const resolvedTopics = messageTopics
      .map((message: { topic: string }) => message.topic.trim())
      .filter(Boolean);
    const requestedTopics = Array.from(new Set([...explicitTopics, ...resolvedTopics]));

    const foundMessageIds = new Set(messageTopics.map((message: { id: string }) => message.id));
    const unresolvedMessageIds = messageIds.filter((id) => !foundMessageIds.has(id));

    if (requestedTopics.length === 0) {
      throw new ApiError(400, "No valid topics found to subscribe");
    }

    try {
      const downstream = await connectAdminClient.subscribeTopics(requestedTopics, correlationId);

      return {
        success: true,
        requestedTopics,
        unresolvedMessageIds,
        downstream,
      };
    } catch (error) {
      throwMappedError(error);
    }
  },

  async getCatalogProfile(deviceRecordId: string) {
    const profile = await resolveCatalogProfile(deviceRecordId);

    return {
      device: profile.device,
      item: profile.item,
      communication: profile.communication,
      thingId: profile.thingId ?? null,
      thingName: profile.thingName ?? profile.provisioning.thingName,
      connectAdminDeviceId: profile.connectAdminDeviceId,
      provisioning: profile.provisioning,
      commands: profile.commands.map((command) => ({
        key: command.key,
        messageId: command.message.id,
        name: command.message.name,
        commandType: command.message.commandType,
        messageType: command.message.messageType,
        policyType: command.message.policyType,
        communicationMethod: command.message.communicationMethod,
        topicTemplate: command.topicTemplate,
        subTopic: command.subTopic ?? null,
        topicUnique: command.message.topicUnique,
        isPayloadCentric: command.message.isPayloadCentric,
        payloadTemplate: command.payloadTemplate,
        confirmationPayloadTemplate: command.confirmationPayloadTemplate,
      })),
      messages: profile.messages.map((message) => ({
        id: message.id,
        name: message.name,
        topic: message.topic,
        messageType: message.messageType,
        commandType: message.commandType,
        policyType: message.policyType,
        communicationMethod: message.communicationMethod,
        topicUnique: message.topicUnique,
        isPayloadCentric: message.isPayloadCentric,
        requestPayloadFormat: message.requestPayloadFormat,
        responsePayloadFormat: message.responsePayloadFormat,
      })),
    };
  },

  async provisionCatalogDevice(
    deviceRecordId: string,
    input: CatalogProvisionInput,
    correlationId?: string
  ) {
    const profile = await resolveCatalogProfile(deviceRecordId);
    const provisionPayload = {
      ...profile.provisioning,
      ...input,
      attributes: {
        ...profile.provisioning.attributes,
        ...(input.attributes ?? {}),
      },
    };

    try {
      const result = await connectAdminClient.provisionThing(
        provisionPayload,
        correlationId
      ) as Record<string, unknown>;
      const deviceResponse = isPlainObject(result.device) ? result.device : {};
      const provisioning = isPlainObject(result.provisioning) ? result.provisioning : {};
      const thingId =
        getString(deviceResponse.thingId) ??
        getString(provisioning.thingName) ??
        provisionPayload.thingName;

      await prisma.device.update({
        where: { id: deviceRecordId },
        data: {
          foreignId: thingId,
          status: "active",
          metadata: mergeIotMetadata(profile.device.metadata, {
            thingId,
            thingName: getString(provisioning.thingName) ?? thingId,
            certificateId: getString(provisioning.certificateId) ?? null,
            certificateArn: getString(provisioning.certificateArn) ?? null,
            region: getString(provisioning.region) ?? null,
            bucket: getString(provisioning.bucket) ?? null,
            policyAttached: getString(provisioning.policyAttached) ?? null,
            s3Keys: isPlainObject(provisioning.s3Keys) ? provisioning.s3Keys : null,
            documents:
              getString(provisioning.bucket) && isPlainObject(provisioning.s3Keys)
                ? {
                    certificate: `s3://${provisioning.bucket}/${String(provisioning.s3Keys.certificate ?? "")}`,
                    privateKey: `s3://${provisioning.bucket}/${String(provisioning.s3Keys.privateKey ?? "")}`,
                    publicKey: `s3://${provisioning.bucket}/${String(provisioning.s3Keys.publicKey ?? "")}`,
                    metadata: `s3://${provisioning.bucket}/${String(provisioning.s3Keys.metadata ?? "")}`,
                  }
                : null,
          }),
        },
      });

      return {
        ...result,
        resolved: {
          deviceRecordId,
          connectAdminDeviceId: profile.connectAdminDeviceId,
          thingId,
        },
      };
    } catch (error) {
      throwMappedError(error);
    }
  },

  async executeCatalogCommand(
    deviceRecordId: string,
    commandKey: string,
    input: CatalogExecuteCommandInput,
    correlationId?: string
  ) {
    const profile = await resolveCatalogProfile(deviceRecordId);
    await ensureConnectAdminRegistrationForProfile(profile, correlationId);

    const command = profile.commands.find((entry) => {
      if (input.messageId && entry.message.id === input.messageId) {
        return true;
      }
      return entry.key === commandKey.trim().toLowerCase();
    });

    if (!command) {
      throw new ApiError(404, `Command '${commandKey}' is not configured for this device`);
    }

    const params = input.parameters ?? {};
    const payloadInput: Record<string, unknown> = input.payload ?? {};
    const context = buildTemplateContext(profile, params, payloadInput);

    const resolvedTopic = getString(input.topic)
      ?? renderTopicTemplate(command.topicTemplate, context)
      ?? "";

    const resolvedPayload = deepMerge(
      renderPayloadTemplate(command.payloadTemplate, context),
      payloadInput
    );

    if (!resolvedPayload.deviceid) {
      resolvedPayload.deviceid = profile.connectAdminDeviceId;
    }

    const subTopic = getString(input.subTopic) ?? command.subTopic;
    if (!subTopic) {
      throw new ApiError(
        400,
        `Unable to resolve MQTT sub-topic for command '${commandKey}'. Configure subTopic or a mqtt/device/{{thingId}}/... topic template.`
      );
    }

    try {
      const downstream = await connectAdminClient.publishToDevice(
        profile.connectAdminDeviceId,
        {
          subTopic,
          payload: resolvedPayload,
        },
        correlationId
      );

      return {
        success: true,
        command: {
          key: command.key,
          messageId: command.message.id,
          topic: resolvedTopic || `mqtt/device/${profile.provisioning.thingName}/${subTopic}`,
          subTopic,
        },
        payload: resolvedPayload,
        downstream,
      };
    } catch (error) {
      throwMappedError(error);
    }
  },

  async subscribeCatalogDevice(
    deviceRecordId: string,
    input: CatalogSubscriptionInput,
    correlationId?: string
  ) {
    const profile = await resolveCatalogProfile(deviceRecordId);
    const explicitTopics = (input.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
    const scopedMessages =
      input.messageIds && input.messageIds.length > 0
        ? profile.messages.filter((message) => input.messageIds?.includes(message.id))
        : profile.messages;

    const context = buildTemplateContext(profile, {}, {});
    const resolvedTopics = scopedMessages
      .map((message) => renderTopicTemplate(message.topic, context))
      .map((topic) => topic.trim())
      .filter(Boolean);

    const requestedTopics = Array.from(new Set([...explicitTopics, ...resolvedTopics]));
    if (requestedTopics.length === 0) {
      throw new ApiError(400, "No valid topics found to subscribe");
    }

    try {
      const downstream = await connectAdminClient.subscribeTopics(requestedTopics, correlationId);
      return {
        success: true,
        requestedTopics,
        downstream,
      };
    } catch (error) {
      throwMappedError(error);
    }
  },
};
