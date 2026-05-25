import { prisma } from "../../config/prisma";
import type { z } from "zod";
import { createVendorSchema, updateVendorSchema } from "./vendor.schema";
import { importVendorFromPostmanCollection } from "./vendor-import.service";

type CreateVendorInput = z.infer<typeof createVendorSchema>;
type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const vendorService = {
  list: () => prisma.vendor.findMany({ orderBy: { createdAt: "desc" } }),
  getById: (id: string) => prisma.vendor.findUnique({ where: { id } }),
  create: (data: CreateVendorInput) => prisma.vendor.create({ data }),
  update: (id: string, data: UpdateVendorInput) => prisma.vendor.update({ where: { id }, data }),
  remove: (id: string) => prisma.vendor.delete({ where: { id } }),
  importPostmanCollection: (input: {
    fileName: string;
    buffer: Buffer;
    vendorName?: string;
    persist?: boolean;
  }) => importVendorFromPostmanCollection(input),
};
