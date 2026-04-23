import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createItemSchema, updateItemSchema } from "./item.schema";

type CreateItemInput = z.infer<typeof createItemSchema>;
type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemService = {
  list: () => prisma.item.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.item.findUnique({ where: { id } }),
  create: (data: CreateItemInput) => prisma.item.create({ data }),
  update: (id: string, data: UpdateItemInput) => prisma.item.update({ where: { id }, data }),
  remove: (id: string) => prisma.item.delete({ where: { id } }),
};
