import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  industry: z.string().optional(),
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
