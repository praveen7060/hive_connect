import { createHash, randomUUID } from "crypto";
import QRCode from "qrcode";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import {
  ConnectAdminHttpError,
  connectAdminClient,
  getConnectAdminBaseUrl,
} from "../iot-orchestration/connectAdmin.client";
import { uploadDeviceOnboardingQrSvgToS3 } from "./deviceQrAssetStorage.service";

type DeviceMutationInput = {
  name?: string;
  foreignId?: string;
  gatewayForeignId?: string;
  serialNumber?: string;
  image?: string;
  icon?: string;
  connectionType?: string;
  project?: string;
  metadata?: string;
  address?: string;
  addressDetails?: string;
  houseNo?: string;
  block?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  status?: string;
};

type WorkflowMode = "create" | "update";

type WorkflowBootstrap = {
  mode: WorkflowMode;
  workflowId: string;
  workflowVersion: number;
  provisionalDevice: any;
  previousDevice: any | null;
  mergedMetadata: Record<string, unknown>;
  requestedThingId: string;
  connectAdminDeviceType: string;
  thingTypeName: string;
  s3Prefix: string;
  attributes: Record<string, string>;
  channels?: string;
  policyName?: string;
};

type ProvisioningSummary = {
  thingName: string;
  thingArn?: string | null;
  thingTypeName?: string | null;
  certificateId: string;
  certificateArn: string;
  certificateStatus?: string | null;
  awsAccountId?: string | null;
  region: string;
  bucket: string;
  assetVersion?: number;
  policyAttached?: string | null;
  s3Keys: {
    certificate: string;
    privateKey: string;
    publicKey: string;
    metadata: string;
  };
  generatedAt?: string | null;
};

function logWorkflow(event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "orbit.device-onboarding",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseJsonObject(value: string | null | undefined, fieldName = "metadata") {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainObject(parsed)) {
      throw new ApiError(400, `${fieldName} must be a JSON object`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, `${fieldName} must be valid JSON`);
  }
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key] as Record<string, unknown>, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function sanitizeIdentifier(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_:]+|[-_:]+$/g, "");

  return normalized || fallback;
}

function sanitizeAttributeValue(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.,@/:#=\[\]-]/g, "_")
    .slice(0, 800);
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

function generateThingId(serialNumber: string) {
  return `thing-${sanitizeIdentifier(serialNumber, "device")}`;
}

function generateThingTypeName(deviceType: string) {
  return `ccms-${sanitizeIdentifier(deviceType, "generic")}`;
}

function stringifyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function serializeForAudit(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.stringify(value, null, 2);
}

function extractProvisioningSummary(result: any): ProvisioningSummary {
  const provisioning = result?.provisioning;
  if (!isPlainObject(provisioning)) {
    throw new ApiError(500, "Provisioning response did not include certificate references");
  }

  const thingName = getString(provisioning.thingName);
  const certificateId = getString(provisioning.certificateId);
  const certificateArn = getString(provisioning.certificateArn);
  const region = getString(provisioning.region);
  const bucket = getString(provisioning.bucket);
  const s3Keys = isPlainObject(provisioning.s3Keys) ? provisioning.s3Keys : null;

  if (
    !thingName ||
    !certificateId ||
    !certificateArn ||
    !region ||
    !bucket ||
    !s3Keys ||
    !getString(s3Keys.certificate) ||
    !getString(s3Keys.privateKey) ||
    !getString(s3Keys.publicKey) ||
    !getString(s3Keys.metadata)
  ) {
    throw new ApiError(500, "Provisioning response was missing required certificate metadata");
  }

  return {
    thingName,
    thingArn: getString(provisioning.thingArn) ?? null,
    thingTypeName: getString(provisioning.thingTypeName) ?? null,
    certificateId,
    certificateArn,
    certificateStatus: getString(provisioning.certificateStatus) ?? null,
    awsAccountId: getString(provisioning.awsAccountId) ?? null,
    region,
    bucket,
    assetVersion:
      typeof provisioning.assetVersion === "number" && Number.isFinite(provisioning.assetVersion)
        ? provisioning.assetVersion
        : undefined,
    policyAttached: getString(provisioning.policyAttached) ?? null,
    generatedAt: getString(provisioning.generatedAt) ?? null,
    s3Keys: {
      certificate: String(s3Keys.certificate),
      privateKey: String(s3Keys.privateKey),
      publicKey: String(s3Keys.publicKey),
      metadata: String(s3Keys.metadata),
    },
  };
}

function buildIotDocuments(summary: ProvisioningSummary) {
  return {
    certificate: `s3://${summary.bucket}/${summary.s3Keys.certificate}`,
    privateKey: `s3://${summary.bucket}/${summary.s3Keys.privateKey}`,
    publicKey: `s3://${summary.bucket}/${summary.s3Keys.publicKey}`,
    metadata: `s3://${summary.bucket}/${summary.s3Keys.metadata}`,
  };
}

function buildMetadataAfterProvisioning(
  mergedMetadata: Record<string, unknown>,
  device: any,
  bootstrap: WorkflowBootstrap,
  provisioning: ProvisioningSummary,
  workflowId: string,
  workflowVersion: number,
  qrAsset?: {
    bucket: string;
    region: string;
    objectKey: string;
    checksum: string;
    uploadedAt: string;
  }
) {
  const currentCatalog = isPlainObject(mergedMetadata.catalog) ? mergedMetadata.catalog : {};
  const currentProvisioning = isPlainObject(currentCatalog.provisioning)
    ? currentCatalog.provisioning
    : {};
  const currentOnboarding = isPlainObject(mergedMetadata.onboarding) ? mergedMetadata.onboarding : {};

  return {
    ...mergedMetadata,
    catalog: {
      ...currentCatalog,
      thingName: provisioning.thingName,
      connectAdminDeviceId: device.serialNumber,
      provisioning: {
        ...currentProvisioning,
        thingName: provisioning.thingName,
        thingTypeName: provisioning.thingTypeName ?? bootstrap.thingTypeName,
        deviceType: bootstrap.connectAdminDeviceType,
        policyName: bootstrap.policyName ?? null,
        channels: bootstrap.channels ?? null,
        s3Prefix: bootstrap.s3Prefix,
        attributes: bootstrap.attributes,
      },
    },
    iot: {
      deviceId: device.serialNumber,
      thingId: provisioning.thingName,
      thingName: provisioning.thingName,
      thingTypeName: provisioning.thingTypeName ?? bootstrap.thingTypeName,
      certificateId: provisioning.certificateId,
      certificateArn: provisioning.certificateArn,
      certificateStatus: provisioning.certificateStatus ?? "ACTIVE",
      bucket: provisioning.bucket,
      region: provisioning.region,
      assetVersion: provisioning.assetVersion ?? workflowVersion,
      policyAttached: provisioning.policyAttached ?? null,
      s3Keys: provisioning.s3Keys,
      documents: buildIotDocuments(provisioning),
      validatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workflowId,
    },
    onboarding: {
      ...currentOnboarding,
      workflowId,
      version: workflowVersion,
      status: "active",
      generatedAt: qrAsset?.uploadedAt ?? null,
      qr: qrAsset
        ? {
            bucket: qrAsset.bucket,
            region: qrAsset.region,
            objectKey: qrAsset.objectKey,
            checksum: qrAsset.checksum,
            version: workflowVersion,
            uploadedAt: qrAsset.uploadedAt,
          }
        : currentOnboarding.qr ?? null,
    },
  };
}

async function buildQrSvg(payload: string) {
  return QRCode.toString(payload, {
    type: "svg",
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

async function createAudit(data: {
  deviceId?: string | null;
  workflowId: string;
  action: string;
  status: string;
  deviceSerialNumber: string;
  thingId?: string | null;
  message?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorPayload?: unknown;
}) {
  const db = prisma as any;
  await db.deviceProvisioningAudit.create({
    data: {
      deviceId: data.deviceId ?? null,
      workflowId: data.workflowId,
      action: data.action,
      status: data.status,
      deviceSerialNumber: data.deviceSerialNumber,
      thingId: data.thingId ?? null,
      message: data.message ?? null,
      requestPayload: serializeForAudit(data.requestPayload) ?? null,
      responsePayload: serializeForAudit(data.responsePayload) ?? null,
      errorPayload: serializeForAudit(data.errorPayload) ?? null,
    },
  });
}

function getProvisioningAttributes(input: {
  name: string;
  project: string;
  connectionType: string;
  mergedMetadata: Record<string, unknown>;
}) {
  const catalog = isPlainObject(input.mergedMetadata.catalog) ? input.mergedMetadata.catalog : {};
  const provisioning = isPlainObject(catalog.provisioning) ? catalog.provisioning : {};
  const attributeSource = isPlainObject(provisioning.attributes)
    ? provisioning.attributes
    : isPlainObject(catalog.attributes)
      ? catalog.attributes
      : {};

  const attributes: Record<string, string> = {
    displayName: sanitizeAttributeValue(input.name),
    project: sanitizeAttributeValue(input.project),
    connectionType: sanitizeAttributeValue(input.connectionType),
  };

  for (const [key, value] of Object.entries(attributeSource)) {
    if (value === null || value === undefined) continue;
    const sanitized = sanitizeAttributeValue(String(value));
    if (sanitized) attributes[key] = sanitized;
  }

  return attributes;
}

async function bootstrapWorkflow(
  mode: WorkflowMode,
  input: DeviceMutationInput,
  id?: string
): Promise<WorkflowBootstrap> {
  const serialNumber = getString(input.serialNumber);
  if (!serialNumber && mode === "create") {
    throw new ApiError(400, "serialNumber is required");
  }

  const workflowId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const orm = tx as any;
    const previousDevice = mode === "update"
      ? await orm.device.findUnique({ where: { id } })
      : null;

    if (mode === "update" && !previousDevice) {
      throw new ApiError(404, "Device not found");
    }

    const effectiveSerial = serialNumber ?? previousDevice.serialNumber;
    await orm.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `orbit:device:${effectiveSerial}`);

    const existingMetadata = parseJsonObject(previousDevice?.metadata);
    const incomingMetadata = parseJsonObject(input.metadata);
    const mergedMetadata = deepMerge(existingMetadata, incomingMetadata);

    const name = getString(input.name) ?? previousDevice?.name;
    const connectionType = getString(input.connectionType) ?? previousDevice?.connectionType;
    const project = getString(input.project) ?? previousDevice?.project;
    if (!name || !connectionType || !project || !effectiveSerial) {
      throw new ApiError(400, "name, serialNumber, connectionType, and project are required");
    }

    const catalog = isPlainObject(mergedMetadata.catalog) ? mergedMetadata.catalog : {};
    const provisioning = isPlainObject(catalog.provisioning) ? catalog.provisioning : {};
    const requestedThingId =
      getString(input.foreignId) ??
      getString(provisioning.thingName) ??
      getString(catalog.thingName) ??
      getString(previousDevice?.foreignId) ??
      generateThingId(effectiveSerial);
    await orm.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `orbit:thing:${requestedThingId}`);

    if (mode === "update" && previousDevice?.foreignId && requestedThingId !== previousDevice.foreignId) {
      throw new ApiError(409, "Thing ID cannot be changed for an already provisioned device");
    }

    const duplicateSerial = await orm.device.findFirst({
      where: previousDevice?.id
        ? { serialNumber: effectiveSerial, NOT: { id: previousDevice.id } }
        : { serialNumber: effectiveSerial },
    });
    if (duplicateSerial) {
      throw new ApiError(409, "Device ID already exists");
    }

    const duplicateThing = await orm.device.findFirst({
      where: previousDevice?.id
        ? { foreignId: requestedThingId, NOT: { id: previousDevice.id } }
        : { foreignId: requestedThingId },
    });
    if (duplicateThing) {
      throw new ApiError(409, "Thing ID already exists");
    }

    const connectAdminDeviceType = mapConnectAdminDeviceType(
      getString(provisioning.deviceType) ?? getString(catalog.deviceType),
      effectiveSerial
    );
    const workflowVersion = Number(previousDevice?.onboardingVersion ?? 0) + 1;
    const channels =
      getString(provisioning.channels) ??
      getString(catalog.channels) ??
      undefined;

    const devicePayload = {
      name,
      foreignId: requestedThingId,
      gatewayForeignId: getString(input.gatewayForeignId) ?? previousDevice?.gatewayForeignId ?? null,
      serialNumber: effectiveSerial,
      image: getString(input.image) ?? previousDevice?.image ?? null,
      icon: getString(input.icon) ?? previousDevice?.icon ?? null,
      connectionType,
      project,
      metadata: stringifyJson(mergedMetadata),
      address: getString(input.address) ?? previousDevice?.address ?? null,
      addressDetails: getString(input.addressDetails) ?? previousDevice?.addressDetails ?? null,
      houseNo: getString(input.houseNo) ?? previousDevice?.houseNo ?? null,
      block: getString(input.block) ?? previousDevice?.block ?? null,
      street: getString(input.street) ?? previousDevice?.street ?? null,
      city: getString(input.city) ?? previousDevice?.city ?? null,
      state: getString(input.state) ?? previousDevice?.state ?? null,
      country: getString(input.country) ?? previousDevice?.country ?? null,
      zipCode: getString(input.zipCode) ?? previousDevice?.zipCode ?? null,
      status: "provisioning",
    };

    const provisionalDevice =
      mode === "create"
        ? await orm.device.create({ data: devicePayload })
        : await orm.device.update({ where: { id }, data: devicePayload });

    const s3Prefix =
      getString(provisioning.s3Prefix) ??
      `devices/${provisionalDevice.id}/things/${requestedThingId}/certificates`;
    const policyName = getString(provisioning.policyName) ?? getString(catalog.policyName);
    const attributes = getProvisioningAttributes({
      name,
      project,
      connectionType,
      mergedMetadata,
    });

    await orm.deviceProvisioningAudit.create({
      data: {
        deviceId: provisionalDevice.id,
        workflowId,
        action: mode,
        status: "started",
        deviceSerialNumber: effectiveSerial,
        thingId: requestedThingId,
        message: `${mode} workflow started`,
        requestPayload: stringifyJson({
          device: devicePayload,
          provisioning: {
            connectAdminDeviceType,
            thingTypeName: generateThingTypeName(connectAdminDeviceType),
            channels,
            policyName: policyName ?? null,
            s3Prefix,
            attributes,
          },
        }),
      },
    });

    return {
      mode,
      workflowId,
      workflowVersion,
      provisionalDevice,
      previousDevice,
      mergedMetadata,
      requestedThingId,
      connectAdminDeviceType,
      thingTypeName: generateThingTypeName(connectAdminDeviceType),
      s3Prefix,
      attributes,
      channels,
      policyName,
    };
  });
}

async function restoreLocalState(bootstrap: WorkflowBootstrap) {
  const db = prisma as any;

  if (bootstrap.mode === "create") {
    await db.deviceOnboardingQrAsset.deleteMany({
      where: { deviceId: bootstrap.provisionalDevice.id },
    });
    await db.deviceCertificateAsset.deleteMany({
      where: { deviceId: bootstrap.provisionalDevice.id },
    });
    await db.device.deleteMany({
      where: { id: bootstrap.provisionalDevice.id },
    });
    return;
  }

  if (!bootstrap.previousDevice) {
    return;
  }

  await db.device.update({
    where: { id: bootstrap.provisionalDevice.id },
    data: {
      name: bootstrap.previousDevice.name,
      foreignId: bootstrap.previousDevice.foreignId,
      gatewayForeignId: bootstrap.previousDevice.gatewayForeignId,
      serialNumber: bootstrap.previousDevice.serialNumber,
      image: bootstrap.previousDevice.image,
      icon: bootstrap.previousDevice.icon,
      connectionType: bootstrap.previousDevice.connectionType,
      project: bootstrap.previousDevice.project,
      metadata: bootstrap.previousDevice.metadata,
      address: bootstrap.previousDevice.address,
      addressDetails: bootstrap.previousDevice.addressDetails,
      houseNo: bootstrap.previousDevice.houseNo,
      block: bootstrap.previousDevice.block,
      street: bootstrap.previousDevice.street,
      city: bootstrap.previousDevice.city,
      state: bootstrap.previousDevice.state,
      country: bootstrap.previousDevice.country,
      zipCode: bootstrap.previousDevice.zipCode,
      status: bootstrap.previousDevice.status,
      onboardingVersion: bootstrap.previousDevice.onboardingVersion,
      lastProvisionedAt: bootstrap.previousDevice.lastProvisionedAt,
      lastQrGeneratedAt: bootstrap.previousDevice.lastQrGeneratedAt,
    },
  });
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

function mapConnectAdminError(error: unknown): never {
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
  throw new ApiError(500, "Internal onboarding orchestration failure");
}

async function finalizeProvisioning(
  bootstrap: WorkflowBootstrap,
  provisioning: ProvisioningSummary
) {
  const metadata = buildMetadataAfterProvisioning(
    bootstrap.mergedMetadata,
    bootstrap.provisionalDevice,
    bootstrap,
    provisioning,
    bootstrap.workflowId,
    bootstrap.workflowVersion
  );

  await prisma.$transaction(async (tx) => {
    const orm = tx as any;
    await orm.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      `orbit:device:${bootstrap.provisionalDevice.id}`
    );

    await orm.device.update({
      where: { id: bootstrap.provisionalDevice.id },
      data: {
        foreignId: provisioning.thingName,
        metadata: stringifyJson(metadata),
        status: "active",
        lastProvisionedAt: new Date(provisioning.generatedAt ?? new Date().toISOString()),
      },
    });

    const existingCertificateAsset = await orm.deviceCertificateAsset.findFirst({
      where: { certificateId: provisioning.certificateId },
    });

    if (!existingCertificateAsset) {
      await orm.deviceCertificateAsset.updateMany({
        where: { deviceId: bootstrap.provisionalDevice.id, status: "active" },
        data: { status: "superseded" },
      });

      await orm.deviceCertificateAsset.create({
        data: {
          deviceId: bootstrap.provisionalDevice.id,
          version: provisioning.assetVersion ?? bootstrap.workflowVersion,
          thingId: provisioning.thingName,
          certificateId: provisioning.certificateId,
          certificateArn: provisioning.certificateArn,
          bucket: provisioning.bucket,
          region: provisioning.region,
          certificateKey: provisioning.s3Keys.certificate,
          privateKeyKey: provisioning.s3Keys.privateKey,
          publicKeyKey: provisioning.s3Keys.publicKey,
          metadataKey: provisioning.s3Keys.metadata,
          checksum: createHash("sha256")
            .update(
              [
                provisioning.certificateId,
                provisioning.certificateArn,
                provisioning.s3Keys.certificate,
                provisioning.s3Keys.privateKey,
                provisioning.s3Keys.publicKey,
                provisioning.s3Keys.metadata,
              ].join("|")
            )
            .digest("hex"),
          uploadedAt: new Date(provisioning.generatedAt ?? new Date().toISOString()),
        },
      });
    }
  });

  await createAudit({
    deviceId: bootstrap.provisionalDevice.id,
    workflowId: bootstrap.workflowId,
    action: "provisioning",
    status: "succeeded",
    deviceSerialNumber: bootstrap.provisionalDevice.serialNumber,
    thingId: provisioning.thingName,
    message: "Provisioning metadata persisted",
    responsePayload: provisioning,
  });

  return metadata;
}

async function finalizeQr(
  bootstrap: WorkflowBootstrap,
  provisioning: ProvisioningSummary,
  metadata: Record<string, unknown>,
  qrPayloadObject: Record<string, unknown>,
  qrAsset: {
    bucket: string;
    region: string;
    objectKey: string;
    checksum: string;
    uploadedAt: string;
    contentType: "image/svg+xml";
  }
) {
  const finalMetadata = buildMetadataAfterProvisioning(
    metadata,
    bootstrap.provisionalDevice,
    bootstrap,
    provisioning,
    bootstrap.workflowId,
    bootstrap.workflowVersion,
    qrAsset
  );

  return prisma.$transaction(async (tx) => {
    const orm = tx as any;
    await orm.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      `orbit:device:${bootstrap.provisionalDevice.id}`
    );

    const certificateAsset = await orm.deviceCertificateAsset.findFirst({
      where: {
        deviceId: bootstrap.provisionalDevice.id,
        certificateId: provisioning.certificateId,
      },
      orderBy: { createdAt: "desc" },
    });

    await orm.deviceOnboardingQrAsset.updateMany({
      where: { deviceId: bootstrap.provisionalDevice.id, status: "active" },
      data: { status: "archived" },
    });

    const qrAssetRecord = await orm.deviceOnboardingQrAsset.create({
      data: {
        deviceId: bootstrap.provisionalDevice.id,
        certificateAssetId: certificateAsset?.id ?? null,
        version: bootstrap.workflowVersion,
        bucket: qrAsset.bucket,
        region: qrAsset.region,
        objectKey: qrAsset.objectKey,
        contentType: qrAsset.contentType,
        checksum: qrAsset.checksum,
        payload: stringifyJson(qrPayloadObject),
        generatedAt: new Date(qrAsset.uploadedAt),
      },
    });

    const device = await orm.device.update({
      where: { id: bootstrap.provisionalDevice.id },
      data: {
        foreignId: provisioning.thingName,
        metadata: stringifyJson(finalMetadata),
        onboardingVersion: bootstrap.workflowVersion,
        lastQrGeneratedAt: new Date(qrAsset.uploadedAt),
        status: "active",
      },
      include: {
        certificateAssets: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        onboardingQrs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return { device, qrAssetRecord };
  });
}

export const deviceOnboardingService = {
  async create(input: DeviceMutationInput) {
    return deviceOnboardingService.save("create", input);
  },

  async update(id: string, input: DeviceMutationInput) {
    return deviceOnboardingService.save("update", input, id);
  },

  async save(mode: WorkflowMode, input: DeviceMutationInput, id?: string) {
    const bootstrap = await bootstrapWorkflow(mode, input, id);

    let provisioningResult: any = null;
    let provisioningSummary: ProvisioningSummary | null = null;
    let persistedMetadata: Record<string, unknown> | null = null;

    try {
      const provisioningPayload = {
        deviceId: bootstrap.provisionalDevice.serialNumber,
        deviceType: bootstrap.connectAdminDeviceType,
        thingName: bootstrap.requestedThingId,
        thingTypeName: bootstrap.thingTypeName,
        policyName: bootstrap.policyName,
        attributes: bootstrap.attributes,
        s3Prefix: bootstrap.s3Prefix,
        channels: bootstrap.channels,
        assetVersion: bootstrap.workflowVersion,
      };

      logWorkflow("provisioning_requested", {
        workflowId: bootstrap.workflowId,
        deviceId: bootstrap.provisionalDevice.id,
        serialNumber: bootstrap.provisionalDevice.serialNumber,
        thingId: bootstrap.requestedThingId,
      });

      try {
        provisioningResult = await connectAdminClient.provisionThing(provisioningPayload, bootstrap.workflowId);
      } catch (error) {
        mapConnectAdminError(error);
      }

      provisioningSummary = extractProvisioningSummary(provisioningResult);
      persistedMetadata = await finalizeProvisioning(bootstrap, provisioningSummary);
      if (!persistedMetadata) {
        throw new ApiError(500, "Failed to persist provisioning metadata");
      }

      const qrPayloadObject = {
        version: bootstrap.workflowVersion,
        workflowId: bootstrap.workflowId,
        generatedAt: new Date().toISOString(),
        device: {
          id: bootstrap.provisionalDevice.id,
          name: bootstrap.provisionalDevice.name,
          serialNumber: bootstrap.provisionalDevice.serialNumber,
          status: "active",
          project: bootstrap.provisionalDevice.project,
          connectionType: bootstrap.provisionalDevice.connectionType,
        },
        thing: {
          id: provisioningSummary.thingName,
          type: provisioningSummary.thingTypeName ?? bootstrap.thingTypeName,
          region: provisioningSummary.region,
        },
        certificates: {
          bucket: provisioningSummary.bucket,
          certificateId: provisioningSummary.certificateId,
          certificateArn: provisioningSummary.certificateArn,
          documents: buildIotDocuments(provisioningSummary),
        },
        onboarding: {
          registrationMetadata: {
            workflowVersion: bootstrap.workflowVersion,
            onboardingVersion: bootstrap.workflowVersion,
            requestedThingId: bootstrap.requestedThingId,
            connectAdminDeviceType: bootstrap.connectAdminDeviceType,
            policyName: bootstrap.policyName ?? null,
            channels: bootstrap.channels ?? null,
          },
        },
      };

      const qrSvg = await buildQrSvg(JSON.stringify(qrPayloadObject));
      const qrAsset = await uploadDeviceOnboardingQrSvgToS3({
        deviceRecordId: bootstrap.provisionalDevice.id,
        thingId: provisioningSummary.thingName,
        version: bootstrap.workflowVersion,
        svg: qrSvg,
      });

      const { device } = await finalizeQr(
        bootstrap,
        provisioningSummary,
        persistedMetadata,
        qrPayloadObject,
        qrAsset
      );

      await createAudit({
        deviceId: bootstrap.provisionalDevice.id,
        workflowId: bootstrap.workflowId,
        action: "qr_generation",
        status: "succeeded",
        deviceSerialNumber: bootstrap.provisionalDevice.serialNumber,
        thingId: provisioningSummary.thingName,
        message: "QR metadata persisted",
        responsePayload: {
          bucket: qrAsset.bucket,
          objectKey: qrAsset.objectKey,
          checksum: qrAsset.checksum,
          version: bootstrap.workflowVersion,
        },
      });

      logWorkflow("workflow_succeeded", {
        workflowId: bootstrap.workflowId,
        deviceId: device.id,
        serialNumber: device.serialNumber,
        thingId: device.foreignId,
      });

      return device;
    } catch (error) {
      const normalizedError =
        error instanceof ApiError ? error : new ApiError(500, error instanceof Error ? error.message : "Device onboarding failed");

      await createAudit({
        deviceId: bootstrap.provisionalDevice.id,
        workflowId: bootstrap.workflowId,
        action: "workflow",
        status: "failed",
        deviceSerialNumber: bootstrap.provisionalDevice.serialNumber,
        thingId: provisioningSummary?.thingName ?? bootstrap.requestedThingId,
        message: normalizedError.message,
        errorPayload: normalizedError.details ?? normalizedError.message,
      }).catch(() => undefined);

      if (!provisioningResult?.reused && provisioningSummary?.thingName) {
        try {
          await connectAdminClient.deprovisionDevice(
            bootstrap.provisionalDevice.serialNumber,
            {
              thingName: provisioningSummary.thingName,
              s3Prefix: bootstrap.s3Prefix,
              deleteS3Objects: true,
              deleteDeviceRecord: false,
            },
            bootstrap.workflowId
          );
        } catch (rollbackError) {
          logWorkflow("remote_rollback_failed", {
            workflowId: bootstrap.workflowId,
            deviceId: bootstrap.provisionalDevice.id,
            message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }
      }

      await restoreLocalState(bootstrap).catch(() => undefined);

      logWorkflow("workflow_failed", {
        workflowId: bootstrap.workflowId,
        deviceId: bootstrap.provisionalDevice.id,
        message: normalizedError.message,
      });

      throw normalizedError;
    }
  },
};
