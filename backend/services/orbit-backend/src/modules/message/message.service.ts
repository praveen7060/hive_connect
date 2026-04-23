import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createMessageSchema, updateMessageSchema } from "./message.schema";

type CreateMessageInput = z.infer<typeof createMessageSchema>;
type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

export const messageService = {
  list: () => prisma.message.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.message.findUnique({ where: { id } }),
  create: (data: CreateMessageInput) => prisma.message.create({ data }),
  update: (id: string, data: UpdateMessageInput) => prisma.message.update({ where: { id }, data }),
  remove: (id: string) => prisma.message.delete({ where: { id } }),
};
