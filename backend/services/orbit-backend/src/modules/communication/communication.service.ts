import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createCommunicationSchema, updateCommunicationSchema } from "./communication.schema";

type CreateCommunicationInput = z.infer<typeof createCommunicationSchema>;
type UpdateCommunicationInput = z.infer<typeof updateCommunicationSchema>;

export const communicationService = {
  list: () => prisma.communication.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.communication.findUnique({ where: { id } }),
  create: (data: CreateCommunicationInput) => prisma.communication.create({ data }),
  update: (id: string, data: UpdateCommunicationInput) =>
    prisma.communication.update({ where: { id }, data }),
  remove: (id: string) => prisma.communication.delete({ where: { id } }),
};
