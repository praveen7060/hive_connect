import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";
import { iotService } from "../iot-orchestration/iot.service";
import { uploadEnrollmentQrSvgToS3 } from "./qrAssetStorage.service";
import type { z } from "zod";
import {
  claimEnrollmentQrSchema,
  createConsoleApplicationSchema,
  createEnrollmentQrSchema,
  executeClaimedCommandSchema,
  updateConsoleApplicationSchema,
} from "./applicationConsole.schema";

type CreateConsoleApplicationInput = z.infer<typeof createConsoleApplicationSchema>;
type UpdateConsoleApplicationInput = z.infer<typeof updateConsoleApplicationSchema>;
type CreateEnrollmentQrInput = z.infer<typeof createEnrollmentQrSchema>;
type ClaimEnrollmentQrInput = z.infer<typeof claimEnrollmentQrSchema>;
type ExecuteClaimedCommandInput = z.infer<typeof executeClaimedCommandSchema>;

const DEFAULT_QR_EXPIRY_MINUTES = 15;

function maskKey(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function generateAppKey() {
  return `app_${randomBytes(24).toString("hex")}`;
}

function generateQrToken() {
  return `qr_${randomBytes(24).toString("hex")}`;
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function getConsoleApplication(appId: string) {
  const app = await prisma.consoleApplication.findUnique({ where: { id: appId } });
  if (!app) {
    throw new ApiError(404, "Application not found");
  }
  return app;
}

async function verifyAppCredentials(appId: string, appKey: string) {
  const app = await getConsoleApplication(appId);
  if (app.status !== "active") {
    throw new ApiError(403, "Application is not active");
  }
  if (app.appKey !== appKey) {
    throw new ApiError(401, "Invalid application credentials");
  }
  return app;
}

async function getClaimedDeviceAccess(appId: string, deviceId: string, installationId?: string) {
  const claim = await prisma.deviceAppClaim.findFirst({
    where: {
      appId,
      deviceId,
      status: "active",
      ...(installationId ? { installationId } : {}),
    },
    include: {
      device: true,
      app: true,
    },
    orderBy: { claimedAt: "desc" },
  });

  if (!claim) {
    throw new ApiError(403, "This application has not claimed the device");
  }

  return claim;
}

async function buildQrSvg(payload: string) {
  return QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
}

function serializeClaimMetadata(
  existing: string | null | undefined,
  incoming?: Record<string, unknown>
) {
  const base = parseJsonObject(existing);
  return JSON.stringify(
    {
      ...base,
      ...(incoming ?? {}),
    },
    null,
    2
  );
}

export const applicationConsoleService = {
  listApps() {
    return prisma.consoleApplication.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            claims: true,
            enrollmentQrs: true,
          },
        },
      },
    });
  },

  async getAppById(id: string) {
    const app = await prisma.consoleApplication.findUnique({
      where: { id },
      include: {
        claims: {
          include: { device: true },
          orderBy: { claimedAt: "desc" },
        },
        enrollmentQrs: {
          include: { device: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!app) {
      throw new ApiError(404, "Application not found");
    }

    return app;
  },

  async createApp(input: CreateConsoleApplicationInput) {
    const appKey = generateAppKey();
    return prisma.consoleApplication.create({
      data: {
        ...input,
        appKey,
      },
    });
  },

  async updateApp(id: string, input: UpdateConsoleApplicationInput) {
    await getConsoleApplication(id);
    return prisma.consoleApplication.update({
      where: { id },
      data: input,
    });
  },

  async deleteApp(id: string) {
    await getConsoleApplication(id);
    await prisma.consoleApplication.delete({ where: { id } });
  },

  async createEnrollmentQr(deviceId: string, input: CreateEnrollmentQrInput) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }

    if (input.issuedForAppId) {
      await getConsoleApplication(input.issuedForAppId);
    }

    const token = generateQrToken();
    const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? DEFAULT_QR_EXPIRY_MINUTES) * 60_000);
    const qrPayloadObject = {
      type: input.qrType ?? "device_claim",
      token,
      deviceId: device.id,
      serialNumber: device.serialNumber,
      expiresAt: expiresAt.toISOString(),
    };
    const qrPayload = JSON.stringify(qrPayloadObject);
    const deepLink = `${input.deepLinkBase ?? "hiveconnect://device-claim"}?token=${encodeURIComponent(token)}`;
    const qrSvg = await buildQrSvg(deepLink);

    const record = await prisma.deviceEnrollmentQr.create({
      data: {
        deviceId: device.id,
        issuedForAppId: input.issuedForAppId,
        token,
        qrType: input.qrType ?? "device_claim",
        payload: qrPayload,
        expiresAt,
      },
    });

    const asset = await uploadEnrollmentQrSvgToS3({
      deviceRecordId: device.id,
      enrollmentId: record.id,
      token,
      svg: qrSvg,
    });
    const storedPayloadObject = {
      ...qrPayloadObject,
      asset,
    };

    const updatedRecord = await prisma.deviceEnrollmentQr.update({
      where: { id: record.id },
      data: {
        payload: JSON.stringify(storedPayloadObject),
      },
    });

    return {
      enrollment: updatedRecord,
      device: {
        id: device.id,
        name: device.name,
        serialNumber: device.serialNumber,
      },
      qr: {
        token,
        payload: storedPayloadObject,
        deepLink,
        svg: qrSvg,
        asset,
      },
    };
  },

  async claimEnrollmentQr(input: ClaimEnrollmentQrInput) {
    const app = await verifyAppCredentials(input.appId, input.appKey);
    const enrollment = await prisma.deviceEnrollmentQr.findUnique({
      where: { token: input.qrToken },
      include: { device: true },
    });

    if (!enrollment) {
      throw new ApiError(404, "Enrollment QR not found");
    }
    if (enrollment.status !== "pending") {
      throw new ApiError(409, "Enrollment QR is no longer available");
    }
    if (enrollment.issuedForAppId && enrollment.issuedForAppId !== app.id) {
      throw new ApiError(403, "Enrollment QR was issued for a different application");
    }
    if (enrollment.expiresAt.getTime() < Date.now()) {
      await prisma.deviceEnrollmentQr.update({
        where: { id: enrollment.id },
        data: { status: "expired" },
      });
      throw new ApiError(410, "Enrollment QR has expired");
    }

    const claim = await prisma.deviceAppClaim.upsert({
      where: {
        deviceId_appId: {
          deviceId: enrollment.deviceId,
          appId: app.id,
        },
      },
      update: {
        installationId: input.installationId,
        alias: input.alias,
        status: "active",
        enrollmentQrId: enrollment.id,
        metadata: serializeClaimMetadata(undefined, input.metadata),
        claimedAt: new Date(),
      },
      create: {
        deviceId: enrollment.deviceId,
        appId: app.id,
        enrollmentQrId: enrollment.id,
        installationId: input.installationId,
        alias: input.alias,
        status: "active",
        metadata: serializeClaimMetadata(undefined, input.metadata),
        claimedAt: new Date(),
      },
    });

    await prisma.deviceEnrollmentQr.update({
      where: { id: enrollment.id },
      data: {
        status: "claimed",
        claimedAt: new Date(),
        claimedByAppId: app.id,
      },
    });

    await prisma.consoleApplication.update({
      where: { id: app.id },
      data: { lastClaimedAt: new Date() },
    });

    return {
      success: true,
      app: {
        id: app.id,
        name: app.name,
        appKeyMasked: maskKey(app.appKey),
      },
      device: enrollment.device,
      claim,
    };
  },

  async listClaimedDevices(appId: string, appKey?: string) {
    if (!appKey) {
      throw new ApiError(401, "Application key is required");
    }
    await verifyAppCredentials(appId, appKey);

    return prisma.deviceAppClaim.findMany({
      where: { appId, status: "active" },
      include: {
        device: true,
      },
      orderBy: { claimedAt: "desc" },
    });
  },

  async executeClaimedCommand(
    appId: string,
    deviceId: string,
    commandKey: string,
    input: ExecuteClaimedCommandInput,
    appKeyHeader?: string
  ) {
    const appKey = appKeyHeader ?? input.appKey;
    if (!appKey) {
      throw new ApiError(401, "Application key is required");
    }

    await verifyAppCredentials(appId, appKey);
    await getClaimedDeviceAccess(appId, deviceId, input.installationId);

    return iotService.executeCatalogCommand(deviceId, commandKey, {
      messageId: input.messageId,
      payload: input.payload,
      parameters: input.parameters,
      topic: input.topic,
      subTopic: input.subTopic,
    });
  },
};
