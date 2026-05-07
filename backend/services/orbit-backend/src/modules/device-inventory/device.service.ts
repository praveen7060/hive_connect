import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import {
  ConnectAdminHttpError,
  connectAdminClient,
  getConnectAdminBaseUrl,
} from "../iot-orchestration/connectAdmin.client";
import type { z } from "zod";
import { createDeviceSchema, discoveredDeviceSyncSchema, updateDeviceSchema } from "./device.schema";
import { ensureElevateCatalog } from "./elevateCatalog";

type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
type DiscoveredDeviceSyncInput = z.infer<typeof discoveredDeviceSyncSchema>;

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

function parseIotMetadata(metadata: string | null | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!isPlainObject(parsed)) {
      return null;
    }

    const iot = parsed.iot;
    if (!isPlainObject(iot)) {
      return null;
    }

    return iot;
  } catch {
    return null;
  }
}

function extractS3Prefix(iotMetadata: Record<string, unknown> | null, thingName: string | undefined) {
  if (!iotMetadata || !thingName) {
    return undefined;
  }

  let certificateKey = "";

  const s3Keys = iotMetadata.s3Keys;
  if (isPlainObject(s3Keys)) {
    certificateKey = getString(s3Keys.certificate) ?? "";
  }

  if (!certificateKey) {
    const documents = iotMetadata.documents;
    if (isPlainObject(documents)) {
      certificateKey = getString(documents.certificate) ?? "";
    }
  }

  if (!certificateKey) {
    return undefined;
  }

  const normalizedKey = certificateKey.startsWith("s3://")
    ? certificateKey.replace(/^s3:\/\/[^/]+\//, "")
    : certificateKey;

  const marker = `/${thingName}/`;
  const markerIndex = normalizedKey.indexOf(marker);

  if (markerIndex <= 0) {
    return undefined;
  }

  const prefix = normalizedKey.slice(0, markerIndex).replace(/^\/+|\/+$/g, "");
  return prefix || undefined;
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

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function getDiscoveredDeviceName(serialNumber: string, fallbackName?: string) {
  const explicit = getString(fallbackName);
  if (explicit) {
    return explicit;
  }

  return serialNumber;
}

function mapConnectAdminDeviceType(catalogDeviceType: string | undefined, serialNumber: string) {
  const normalized = (catalogDeviceType ?? "").trim().toLowerCase();
  const serial = serialNumber.trim().toUpperCase();

  if (normalized.includes("switch_4ch") || serial.startsWith("IOTIQ4SC_")) {
    return "SWITCH_4CH";
  }

  if (normalized.includes("dongle") || serial.startsWith("IOTIQDC2_")) {
    return "DONGLE_2CH";
  }

  if (normalized.includes("smart_meter") || serial.startsWith("IOTIQSM_")) {
    return "SMART_METER";
  }

  return "GENERIC";
}

async function ensureConnectAdminRegistration(payload: {
  serialNumber: string;
  catalogDeviceType?: string;
  thingId?: string;
  channels?: string;
  firmwareVersion?: string;
}) {
  try {
    await connectAdminClient.registerDevice({
      deviceId: payload.serialNumber,
      deviceType: mapConnectAdminDeviceType(payload.catalogDeviceType, payload.serialNumber),
      thingId: payload.thingId,
      channels: payload.channels,
      firmwareVersion: payload.firmwareVersion,
    });
  } catch (error) {
    if (error instanceof ConnectAdminHttpError) {
      throw new ApiError(error.statusCode, error.message, error.details);
    }
    if (isConnectAdminUnavailableError(error)) {
      throw new ApiError(
        503,
        "Connect-admin service is unavailable. Ensure connect-admin is running on http://localhost:4000."
      );
    }
    throw new ApiError(500, "Failed to register device with connect-admin");
  }
}

export const deviceService = {
  list: () => prisma.device.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.device.findUnique({ where: { id } }),
  create: (data: CreateDeviceInput) => prisma.device.create({ data }),
  update: (id: string, data: UpdateDeviceInput) => prisma.device.update({ where: { id }, data }),
  async remove(id: string) {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }

    const iotMetadata = parseIotMetadata(device.metadata);
    const connectAdminDeviceId = getString(iotMetadata?.deviceId);
    const thingId = getString(iotMetadata?.thingId) ?? getString(device.foreignId);
    const thingName = getString(iotMetadata?.thingName) ?? thingId;
    const s3Prefix = extractS3Prefix(iotMetadata, thingName);
    const deprovisionDeviceId =
      connectAdminDeviceId ?? thingId ?? getString(device.serialNumber);

    if (deprovisionDeviceId || thingName) {
      try {
        await connectAdminClient.deprovisionDevice(deprovisionDeviceId ?? thingName ?? id, {
          ...(thingName ? { thingName } : {}),
          ...(s3Prefix ? { s3Prefix } : {}),
          deleteS3Objects: true,
          deleteDeviceRecord: true,
        });
      } catch (error) {
        if (error instanceof ConnectAdminHttpError) {
          if (error.statusCode !== 404 && error.statusCode !== 409) {
            throw new ApiError(error.statusCode, error.message, error.details);
          }
        } else if (isConnectAdminUnavailableError(error)) {
          throw new ApiError(
            503,
            `Connect-admin service is unavailable. Ensure connect-admin is running on ${getConnectAdminBaseUrl()}.`
          );
        } else {
          throw new ApiError(500, "Internal orchestration failure");
        }
      }
    }

    return prisma.device.delete({ where: { id } });
  },
  async upsertDiscovered(data: DiscoveredDeviceSyncInput) {
    const serialNumber = data.serialNumber.trim();
    const source = getString(data.source) ?? "connect-admin";
    const catalogSeed = await ensureElevateCatalog({
      serialNumber,
      channels: getString(data.channels),
      firmwareVersion: getString(data.firmwareVersion),
      thingId: getString(data.thingId),
    });

    const existing = await prisma.device.findFirst({
      where: { serialNumber },
      orderBy: { createdAt: "asc" },
    });

    const currentMetadata = parseJsonObject(existing?.metadata);
    const currentCatalog = isPlainObject(currentMetadata.catalog) ? currentMetadata.catalog : {};
    const currentRuntime = isPlainObject(currentMetadata.runtime) ? currentMetadata.runtime : {};
    const currentDiscovery = isPlainObject(currentMetadata.discovery) ? currentMetadata.discovery : {};
    const seededCatalog = catalogSeed.template.catalog as Record<string, unknown>;

    const catalogMetadata = {
      ...seededCatalog,
      ...currentCatalog,
      vendorName: catalogSeed.vendorName,
      itemType: catalogSeed.template.itemTypeName,
      itemName: catalogSeed.template.itemName,
      itemCode: catalogSeed.template.itemCode,
      communicationPolicy: catalogSeed.template.communicationPolicy,
      deviceType: getString(seededCatalog.deviceType),
      channels: getString(data.channels) ?? catalogSeed.template.channels,
      connectAdminDeviceId: serialNumber,
      thingId: getString(data.thingId) ?? getString(existing?.foreignId),
    };

    const runtimeMetadata = {
      ...currentRuntime,
      firmwareVersion: getString(data.firmwareVersion) ?? currentRuntime.firmwareVersion,
      channels: getString(data.channels) ?? currentRuntime.channels,
      thingId: getString(data.thingId) ?? currentRuntime.thingId,
      lastSeenAt: new Date().toISOString(),
    };

    const discoveryMetadata = {
      ...currentDiscovery,
      source,
      vendor: catalogSeed.vendorName,
      family: catalogSeed.template.familyKey,
      telemetryTopic: getString(data.telemetryTopic) ?? currentDiscovery.telemetryTopic,
      lastPayload: data.rawPayload ?? currentDiscovery.lastPayload,
      lastSyncedAt: new Date().toISOString(),
    };

    const metadata = stringifyJson({
      ...currentMetadata,
      catalog: catalogMetadata,
      runtime: runtimeMetadata,
      discovery: discoveryMetadata,
    });

    const payload = {
      name: getDiscoveredDeviceName(serialNumber, data.name),
      foreignId: getString(data.thingId) ?? existing?.foreignId ?? serialNumber,
      serialNumber,
      connectionType: getString(data.connectionType) ?? existing?.connectionType ?? "MQTT",
      project: getString(data.project) ?? existing?.project ?? "ELEVATE_DISCOVERED",
      status: getString(data.status) ?? existing?.status ?? "active",
      metadata,
    };

    const record = existing
      ? await prisma.device.update({
        where: { id: existing.id },
        data: payload,
      })
      : await prisma.device.create({
        data: payload,
      });

    await ensureConnectAdminRegistration({
      serialNumber,
      catalogDeviceType: getString(catalogMetadata.deviceType),
      thingId: getString(data.thingId) ?? getString(record.foreignId),
      channels: getString(catalogMetadata.channels),
      firmwareVersion: getString(data.firmwareVersion),
    });

    return record;
  },
};
