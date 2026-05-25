import { z } from "zod";

export const importVendorPostmanSchema = z.object({
  vendorName: z.string().min(1).optional(),
  persist: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        return value.trim().toLowerCase() !== "false";
      }
      return true;
    }),
});
