import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createItemTypeSchema, updateItemTypeSchema } from "./itemType.schema";

type CreateItemTypeInput = z.infer<typeof createItemTypeSchema>;
type UpdateItemTypeInput = z.infer<typeof updateItemTypeSchema>;

export const itemTypeService = {
  list: () => prisma.itemType.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.itemType.findUnique({ where: { id } }),
  create: (data: CreateItemTypeInput) => prisma.itemType.create({ data }),
  update: (id: string, data: UpdateItemTypeInput) => prisma.itemType.update({ where: { id }, data }),
  remove: (id: string) => prisma.itemType.delete({ where: { id } }),
};
