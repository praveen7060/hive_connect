import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const requiredString = z.string().trim().min(1);

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

const optionalInteger = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === "string") return Number(normalized);
  return normalized;
}, z.number().int().min(0).optional());

const optionalBoolean = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  if (typeof normalized === "string") {
    const lowered = normalized.toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return normalized;
}, z.boolean().optional());

export const createItemSchema = z.object({
  name: requiredString,
  itemCode: requiredString,
  description: optionalString,
  metadata: optionalString,
  itemPollingConfig: optionalString,
  vendor: requiredString,
  itemType: requiredString,
  communicationPolicy: requiredString,
  gateway: optionalString,
  icon: optionalString,
  tags: optionalString,
  componentCount: optionalInteger,
  secureItem: optionalBoolean,
  image: optionalString,
});

const updateRequiredString = z.preprocess(
  emptyToUndefined,
  requiredString.optional(),
);

export const updateItemSchema = z.object({
  name: updateRequiredString,
  itemCode: updateRequiredString,
  description: optionalString,
  metadata: optionalString,
  itemPollingConfig: optionalString,
  vendor: updateRequiredString,
  itemType: updateRequiredString,
  communicationPolicy: updateRequiredString,
  gateway: optionalString,
  icon: optionalString,
  tags: optionalString,
  componentCount: optionalInteger,
  secureItem: optionalBoolean,
  image: optionalString,
});
