import { z } from "zod";

export const createDeviceSchema = z.object({
  name: z.string().min(1),
  foreignId: z.string().optional(),
  gatewayForeignId: z.string().optional(),
  serialNumber: z.string().min(1),
  image: z.string().optional(),
  icon: z.string().optional(),
  connectionType: z.string().min(1),
  project: z.string().min(1),
  metadata: z.string().optional(),
  address: z.string().optional(),
  addressDetails: z.string().optional(),
  houseNo: z.string().optional(),
  block: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  status: z.string().optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();
