import { z } from "zod";

export const createMessageSchema = z.object({
  name: z.string().optional(),
  itemType: z.string().min(1),
  communicationPolicy: z.string().min(1),
  topic: z.string().min(1),
  messageType: z.string().optional(),
  commandType: z.string().optional(),
  policyType: z.string().optional(),
  retainMessages: z.boolean().optional(),
  loggedMessage: z.boolean().optional(),
  qos: z.number().int().optional(),
  pollingInterval: z.number().int().optional(),
  payloadFormat: z.string().optional(),
  confirmationPayloadFormat: z.string().optional(),
});

export const updateMessageSchema = createMessageSchema.partial();
