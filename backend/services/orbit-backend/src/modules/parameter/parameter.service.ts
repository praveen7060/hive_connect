import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createParameterSchema, updateParameterSchema } from "./parameter.schema";
import { importParametersFromPdf } from "./parameter-import.service";

type CreateParameterInput = z.infer<typeof createParameterSchema>;
type UpdateParameterInput = z.infer<typeof updateParameterSchema>;

export const parameterService = {
  list: () => prisma.parameter.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.parameter.findUnique({ where: { id } }),
  create: (data: CreateParameterInput) => prisma.parameter.create({ data }),
  update: (id: string, data: UpdateParameterInput) =>
    prisma.parameter.update({ where: { id }, data }),
  remove: (id: string) => prisma.parameter.delete({ where: { id } }),
  importDocument: (input: {
    vendor: string;
    fileName: string;
    buffer: Buffer;
    persist?: boolean;
  }) => importParametersFromPdf(input),
};
