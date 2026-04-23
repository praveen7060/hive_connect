import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import { ConnectAdminHttpError, connectAdminClient } from "./connectAdmin.client";
import {
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
      "Connect-admin service is unavailable. Ensure connect-admin is running on http://localhost:4000."
    );
  }
  throw new ApiError(500, "Internal orchestration failure");
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

    const resolvedTopics = messageTopics.map((message) => message.topic.trim()).filter(Boolean);
    const requestedTopics = Array.from(new Set([...explicitTopics, ...resolvedTopics]));

    const foundMessageIds = new Set(messageTopics.map((message) => message.id));
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
};
