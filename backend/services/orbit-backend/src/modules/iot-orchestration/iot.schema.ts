import { z } from "zod";

export const provisionThingSchema = z.object({
  deviceId: z.string().min(1),
  deviceType: z.string().min(1).optional(),
  thingName: z.string().min(1).optional(),
  thingTypeName: z.string().min(1).optional(),
  policyName: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  s3Prefix: z.string().optional(),
  channels: z.string().optional(),
  forceProvision: z.boolean().optional(),
  assetVersion: z.number().int().positive().optional(),
});

export const controlDeviceSchema = z.object({
  status: z.string().min(1),
  switchNo: z.union([z.string(), z.number()]).optional(),
  channel: z.union([z.string(), z.number()]).optional(),
  switch_no: z.union([z.string(), z.number()]).optional(),
});

export const publishDeviceSchema = z.object({
  subTopic: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export const subscribeTopicsSchema = z
  .object({
    topics: z.array(z.string().min(1)).optional(),
    messageIds: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => (value.topics?.length ?? 0) > 0 || (value.messageIds?.length ?? 0) > 0, {
    message: "Either topics or messageIds must be provided",
    path: ["topics"],
  });

export const deviceDocumentsSchema = z.object({
  thingName: z.string().min(1).optional(),
  documentPaths: z
    .object({
      certificate: z.string().min(1).optional(),
      privateKey: z.string().min(1).optional(),
      publicKey: z.string().min(1).optional(),
      metadata: z.string().min(1).optional(),
    })
    .optional(),
});

export const catalogProvisionSchema = z.object({
  thingName: z.string().min(1).optional(),
  policyName: z.string().min(1).optional(),
  s3Prefix: z.string().min(1).optional(),
  channels: z.string().min(1).optional(),
  forceProvision: z.boolean().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  deviceType: z.string().min(1).optional(),
  assetVersion: z.number().int().positive().optional(),
});

export const catalogExecuteCommandSchema = z.object({
  messageId: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  topic: z.string().min(1).optional(),
  subTopic: z.string().min(1).optional(),
});

export const catalogSubscriptionSchema = z.object({
  topics: z.array(z.string().min(1)).optional(),
  messageIds: z.array(z.string().min(1)).optional(),
})
  .refine((value) => (value.topics?.length ?? 0) > 0 || (value.messageIds?.length ?? 0) > 0, {
    message: "Either topics or messageIds must be provided",
    path: ["topics"],
  });

export const telemetryIngestSchema = z.object({
  serialNumber: z.string().min(1),
  topic: z.string().min(1).optional(),
  thingId: z.string().min(1).optional(),
  vendorName: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  receivedAt: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()),
});
