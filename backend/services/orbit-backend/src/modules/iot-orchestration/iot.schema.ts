import { z } from "zod";

const deviceTypeEnum = z.enum(["SINGLE", "SWITCH_4CH", "DONGLE_2CH", "SMART_METER"]);

export const provisionThingSchema = z.object({
  deviceId: z.string().min(1),
  deviceType: deviceTypeEnum.optional(),
  thingName: z.string().min(1).optional(),
  policyName: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  s3Prefix: z.string().optional(),
  channels: z.string().optional(),
  forceProvision: z.boolean().optional(),
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
