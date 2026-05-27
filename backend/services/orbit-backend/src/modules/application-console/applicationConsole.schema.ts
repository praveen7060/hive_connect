import { z } from "zod";

export const createConsoleApplicationSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  applicationCode: z.string().min(1),
  project: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  applicationType: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  bundleVersion: z.string().min(1),
  authType: z.string().min(1),
  sdkUrl: z.string().min(1).optional(),
  bundleUrl: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
  accessKey: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  headerKey: z.string().min(1).optional(),
  metadata: z.string().min(1).optional(),
});

export const updateConsoleApplicationSchema = createConsoleApplicationSchema
  .extend({
    status: z.string().min(1).optional(),
  })
  .partial();

export const createEnrollmentQrSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
  issuedForAppId: z.string().min(1).optional(),
  qrType: z.string().min(1).optional(),
  deepLinkBase: z.string().min(1).optional(),
});

export const createAppLinkQrSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
  deepLinkBase: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const claimEnrollmentQrSchema = z.object({
  appId: z.string().min(1),
  appKey: z.string().min(1),
  qrToken: z.string().min(1),
  installationId: z.string().min(1).optional(),
  alias: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const claimAppLinkQrSchema = z.object({
  qrToken: z.string().min(1),
  installationId: z.string().min(1),
  clientId: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  appVersion: z.string().min(1).optional(),
  deviceModel: z.string().min(1).optional(),
  osVersion: z.string().min(1).optional(),
  pushToken: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const executeClaimedCommandSchema = z.object({
  appKey: z.string().min(1).optional(),
  installationId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  subTopic: z.string().min(1).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
