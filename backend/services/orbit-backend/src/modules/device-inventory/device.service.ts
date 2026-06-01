import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import QRCode from "qrcode";
import {
  ConnectAdminHttpError,
  connectAdminClient,
  getConnectAdminBaseUrl,
} from "../iot-orchestration/connectAdmin.client";
import { deviceOnboardingService } from "./deviceOnboarding.service";
import { uploadDeviceOnboardingQrSvgToS3 } from "./deviceQrAssetStorage.service";
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

function inferDiscoveredChannels(rawPayload: Record<string, unknown> | undefined, fallback?: string) {
  const explicit = getString(fallback);
  if (explicit) return explicit;
  if (!rawPayload || !isPlainObject(rawPayload)) return undefined;

  const channelCandidate = rawPayload.channel;
  const switchCandidate = rawPayload.switch_no ?? rawPayload.switchNo;

  const parsedChannel =
    typeof channelCandidate === "number" && Number.isFinite(channelCandidate)
      ? channelCandidate
      : typeof channelCandidate === "string"
        ? Number(channelCandidate.trim())
        : undefined;
  if (typeof parsedChannel === "number" && Number.isFinite(parsedChannel) && parsedChannel > 0) {
    return `${parsedChannel}S0F`;
  }

  const switchMatch = String(switchCandidate ?? "").trim().match(/^S?(\d+)$/i);
  if (switchMatch) {
    const parsed = Number(switchMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return `${parsed}S0F`;
    }
  }

  return undefined;
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

async function buildQrSvg(payload: string) {
  return QRCode.toString(payload, {
    type: "svg",
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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

async function syncCertificateAssetsFromConnectAdmin(record: {
  id: string;
  metadata: string | null;
  onboardingVersion: number;
}) {
  const deviceMetadata = parseJsonObject(record.metadata);
  const catalog = isPlainObject(deviceMetadata.catalog) ? deviceMetadata.catalog : {};
  const runtime = isPlainObject(deviceMetadata.runtime) ? deviceMetadata.runtime : {};
  const serialNumber =
    getString(catalog.connectAdminDeviceId) ??
    getString(catalog.deviceId) ??
    getString(catalog.serialNumber);

  if (!serialNumber) {
    return;
  }

  let provisioningStatus: unknown;
  try {
    provisioningStatus = await connectAdminClient.getProvisioningStatus(serialNumber);
  } catch (error) {
    if (error instanceof ConnectAdminHttpError && error.statusCode === 404) {
      return;
    }
    if (error instanceof ConnectAdminHttpError) {
      throw new ApiError(error.statusCode, error.message, error.details);
    }
    if (isConnectAdminUnavailableError(error)) {
      throw new ApiError(
        503,
        `Connect-admin service is unavailable. Ensure connect-admin is running on ${getConnectAdminBaseUrl()}.`
      );
    }
    throw new ApiError(500, "Failed to fetch provisioning status from connect-admin");
  }

  if (!isPlainObject(provisioningStatus) || !isPlainObject(provisioningStatus.certificate)) {
    return;
  }

  const certificate = provisioningStatus.certificate;
  const s3Keys = isPlainObject(certificate.s3Keys) ? certificate.s3Keys : null;
  const certificateId = getString(certificate.certificateId);
  const certificateArn = getString(certificate.certificateArn);
  const bucket = getString(certificate.bucket);
  const region = getString(certificate.region);
  const certificateKey = getString(s3Keys?.certificate);
  const privateKeyKey = getString(s3Keys?.privateKey);
  const publicKeyKey = getString(s3Keys?.publicKey);
  const metadataKey = getString(s3Keys?.metadata);

  if (
    !certificateId ||
    !certificateArn ||
    !bucket ||
    !region ||
    !certificateKey ||
    !privateKeyKey ||
    !publicKeyKey ||
    !metadataKey
  ) {
    return;
  }

  const uploadedAt =
    parseDate(certificate.lastProvisionedAt) ??
    parseDate(getString(certificate.generatedAt)) ??
    new Date();
  const version = Number.isFinite(Number(certificate.assetVersion))
    ? Math.max(1, Number(certificate.assetVersion))
    : 1;
  const thingId =
    getString(provisioningStatus.thingId) ??
    getString(runtime.thingId) ??
    getString(catalog.thingId) ??
    "";

  await (prisma as any).$transaction(async (tx: typeof prisma) => {
    await (tx as any).deviceCertificateAsset.updateMany({
      where: {
        deviceId: record.id,
        status: "active",
        NOT: {
          certificateId,
        },
      },
      data: {
        status: "superseded",
      },
    });

    const existingAsset = await (tx as any).deviceCertificateAsset.findFirst({
      where: {
        deviceId: record.id,
        certificateId,
      },
    });

    if (existingAsset) {
      await (tx as any).deviceCertificateAsset.update({
        where: { id: existingAsset.id },
        data: {
          version,
          thingId,
          certificateArn,
          bucket,
          region,
          certificateKey,
          privateKeyKey,
          publicKeyKey,
          metadataKey,
          uploadedAt,
          status: "active",
        },
      });
    } else {
      await (tx as any).deviceCertificateAsset.create({
        data: {
          deviceId: record.id,
          version,
          thingId,
          certificateId,
          certificateArn,
          bucket,
          region,
          certificateKey,
          privateKeyKey,
          publicKeyKey,
          metadataKey,
          uploadedAt,
          status: "active",
        },
      });
    }

    await tx.device.update({
      where: { id: record.id },
      data: {
        onboardingVersion: Math.max(record.onboardingVersion, version),
        lastProvisionedAt: uploadedAt,
      },
    });
  });
}

async function ensureOnboardingQrForDiscoveredDevice(record: {
  id: string;
  name: string;
  serialNumber: string;
  foreignId: string | null;
  connectionType: string;
  project: string;
  metadata: string | null;
  onboardingVersion: number;
}) {
  const fullRecord = await (prisma as any).device.findUnique({
    where: { id: record.id },
    include: {
      certificateAssets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      onboardingQrs: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const certificateAsset = fullRecord?.certificateAssets?.[0];
  if (!certificateAsset) {
    return;
  }

  const version = Math.max(
    Number(certificateAsset.version ?? 1),
    Number(fullRecord?.onboardingVersion ?? record.onboardingVersion ?? 1),
    1
  );

  const currentQr = fullRecord?.onboardingQrs?.[0];
  if (currentQr && Number(currentQr.version) === version) {
    return;
  }

  const metadata = parseJsonObject(fullRecord?.metadata);
  const catalog = isPlainObject(metadata.catalog) ? metadata.catalog : {};
  const payloadObject = {
    version,
    generatedAt: new Date().toISOString(),
    source: "discovered-sync",
    device: {
      id: record.id,
      name: record.name,
      serialNumber: record.serialNumber,
      status: "active",
      project: record.project,
      connectionType: record.connectionType,
    },
    thing: {
      id: certificateAsset.thingId || record.foreignId,
      type: getString(catalog.deviceType) ?? null,
      region: certificateAsset.region,
    },
    certificates: {
      bucket: certificateAsset.bucket,
      certificateId: certificateAsset.certificateId,
      certificateArn: certificateAsset.certificateArn,
      documents: {
        certificate: `s3://${certificateAsset.bucket}/${certificateAsset.certificateKey}`,
        privateKey: `s3://${certificateAsset.bucket}/${certificateAsset.privateKeyKey}`,
        publicKey: `s3://${certificateAsset.bucket}/${certificateAsset.publicKeyKey}`,
        metadata: `s3://${certificateAsset.bucket}/${certificateAsset.metadataKey}`,
      },
    },
    onboarding: {
      registrationMetadata: {
        onboardingVersion: version,
        thingId: certificateAsset.thingId || record.foreignId,
        connectAdminDeviceId:
          getString(catalog.connectAdminDeviceId) ?? record.serialNumber,
        discovered: true,
      },
    },
  };

  const qrSvg = await buildQrSvg(JSON.stringify(payloadObject));
  const qrAsset = await uploadDeviceOnboardingQrSvgToS3({
    deviceRecordId: record.id,
    thingId: certificateAsset.thingId || record.foreignId || record.serialNumber,
    version,
    svg: qrSvg,
  });

  const onboardingMetadata = isPlainObject(metadata.onboarding) ? metadata.onboarding : {};
  const nextMetadata = {
    ...metadata,
    onboarding: {
      ...onboardingMetadata,
      status: "active",
      version,
      generatedAt: qrAsset.uploadedAt,
      qr: {
        bucket: qrAsset.bucket,
        region: qrAsset.region,
        objectKey: qrAsset.objectKey,
        checksum: qrAsset.checksum,
        version,
        uploadedAt: qrAsset.uploadedAt,
      },
    },
  };

  await (prisma as any).$transaction(async (tx: typeof prisma) => {
    await (tx as any).deviceOnboardingQrAsset.updateMany({
      where: { deviceId: record.id, status: "active" },
      data: { status: "archived" },
    });

    await (tx as any).deviceOnboardingQrAsset.create({
      data: {
        deviceId: record.id,
        certificateAssetId: certificateAsset.id,
        version,
        bucket: qrAsset.bucket,
        region: qrAsset.region,
        objectKey: qrAsset.objectKey,
        contentType: qrAsset.contentType,
        checksum: qrAsset.checksum,
        payload: stringifyJson(payloadObject),
        generatedAt: new Date(qrAsset.uploadedAt),
      },
    });

    await tx.device.update({
      where: { id: record.id },
      data: {
        metadata: stringifyJson(nextMetadata),
        onboardingVersion: version,
        lastQrGeneratedAt: new Date(qrAsset.uploadedAt),
      },
    });
  });
}

export const deviceService = {
  list: () => prisma.device.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) =>
    (prisma as any).device.findUnique({
      where: { id },
      include: {
        certificateAssets: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        onboardingQrs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        provisioningAudits: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    }),
  create: (data: CreateDeviceInput) => deviceOnboardingService.create(data),
  update: (id: string, data: UpdateDeviceInput) => deviceOnboardingService.update(id, data),
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
    const resolvedChannels = inferDiscoveredChannels(data.rawPayload, getString(data.channels));
    const catalogSeed = await ensureElevateCatalog({
      serialNumber,
      channels: resolvedChannels,
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
      channels: resolvedChannels ?? catalogSeed.template.channels,
      componentCount:
        typeof seededCatalog.componentCount === "number" && Number.isFinite(seededCatalog.componentCount)
          ? seededCatalog.componentCount
          : catalogSeed.template.componentCount,
      connectAdminDeviceId: serialNumber,
      thingId: getString(data.thingId) ?? getString(existing?.foreignId),
    };

    const runtimeMetadata = {
      ...currentRuntime,
      firmwareVersion: getString(data.firmwareVersion) ?? currentRuntime.firmwareVersion,
      channels: resolvedChannels ?? currentRuntime.channels,
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

    await syncCertificateAssetsFromConnectAdmin({
      id: record.id,
      metadata: record.metadata,
      onboardingVersion: record.onboardingVersion ?? 0,
    });

    await ensureOnboardingQrForDiscoveredDevice({
      id: record.id,
      name: record.name,
      serialNumber: record.serialNumber,
      foreignId: record.foreignId,
      connectionType: record.connectionType,
      project: record.project,
      metadata: record.metadata,
      onboardingVersion: record.onboardingVersion ?? 0,
    });

    return record;
  },
};
