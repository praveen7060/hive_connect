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

export const discoveredDeviceSyncSchema = z.object({
  serialNumber: z.string().min(1),
  name: z.string().optional(),
  connectionType: z.string().optional(),
  project: z.string().optional(),
  status: z.string().optional(),
  thingId: z.string().optional(),
  firmwareVersion: z.string().optional(),
  channels: z.string().optional(),
  vendorName: z.string().optional(),
  source: z.string().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  telemetryTopic: z.string().optional(),
});
