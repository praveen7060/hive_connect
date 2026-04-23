import { z } from "zod";

export const createItemTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  synonyms: z.string().optional(),
  vendorName: z.string().optional(),
  image: z.string().optional(),
});

export const updateItemTypeSchema = createItemTypeSchema.partial();
