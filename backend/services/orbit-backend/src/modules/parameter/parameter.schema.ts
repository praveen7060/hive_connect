import { z } from "zod";

export const createParameterSchema = z.object({
  name: z.string().min(1),
  vendors: z.string().optional(),
  variableType: z.string().optional(),
  pinType: z.string().optional(),
  pinCount: z.number().int().min(0).optional(),
  isConstant: z.boolean().optional(),
});

export const updateParameterSchema = createParameterSchema.partial();
