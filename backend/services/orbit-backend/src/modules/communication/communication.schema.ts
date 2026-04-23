import { z } from "zod";

export const createCommunicationSchema = z.object({
  name: z.string().min(1),
  groupName: z.string().min(1),
  itemType: z.string().min(1),
  protocol: z.string().min(1),
  messageFormat: z.string().min(1),
  centric: z.string().min(1),
  messageStructure: z.string().optional(),
  confirmationMessageStructure: z.string().optional(),
  icon: z.string().min(1),
  needFirmware: z.boolean().optional(),
  needConfirmation: z.boolean().optional(),
  image: z.string().optional(),
});

export const updateCommunicationSchema = createCommunicationSchema.partial();
