import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  industry: z.string().optional(),
  protocol: z.string().optional(),
  apiVersion: z.string().optional(),
  baseUrl: z.string().optional(),
  mqttEndpoint: z.string().optional(),
  websocketUrl: z.string().optional(),
  zigbeeProfile: z.string().optional(),
  uid: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  authType: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  authorizationUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  redirectUri: z.string().optional(),
  tokenType: z.string().optional(),
  apiToken: z.string().optional(),
  jwtToken: z.string().optional(),
  certificate: z.string().optional(),
  publicKey: z.string().optional(),
  privateKey: z.string().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();
