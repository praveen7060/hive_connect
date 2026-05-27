import type { CatalogProfile } from "../iot-orchestration/catalog-resolver";
import type { ProtocolCapability, TelemetryProfile } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeKey(value: string | undefined, fallback: string) {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractParameters(template: unknown, prefix = "", acc = new Set<string>()) {
  if (typeof template === "string") {
    const matches = template.matchAll(/\{\{\s*params\.([^}\s]+)\s*\}\}/g);
    for (const match of matches) {
      acc.add(`${prefix}${match[1]}`);
    }
    return acc;
  }

  if (Array.isArray(template)) {
    template.forEach((entry, index) => extractParameters(entry, `${prefix}${index}.`, acc));
    return acc;
  }

  if (isPlainObject(template)) {
    for (const [key, value] of Object.entries(template)) {
      extractParameters(value, prefix ? `${prefix}${key}.` : `${key}.`, acc);
    }
  }

  return acc;
}

function resolveExpectedFields(message: CatalogProfile["messages"][number]) {
  const parsed = parseJsonObject(message.requestPayloadFormat);
  const expected = parsed.expected;
  return Array.isArray(expected)
    ? expected.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function deriveProtocolCapabilities(profile: CatalogProfile): ProtocolCapability[] {
  const capabilities: ProtocolCapability[] = [];
  const transport = profile.protocol.transport;

  capabilities.push({
    key: "provision_device",
    label: "Provision Device",
    category: "provisioning",
    transport,
    parameters: ["thingName", "policyName", "s3Prefix", "channels", "attributes"],
    metadata: {
      adapterKey: profile.protocol.adapterKey,
      authStrategy: profile.protocol.authStrategy ?? null,
    },
  });

  capabilities.push({
    key: "fetch_documents",
    label: "Fetch Documents",
    category: "document",
    transport,
    parameters: ["thingName", "documentPaths"],
    metadata: {},
  });

  capabilities.push({
    key: "subscribe_topics",
    label: "Subscribe Topics",
    category: "subscription",
    transport,
    parameters: ["topics", "messageIds"],
    metadata: {
      inboundTopics: profile.protocol.inboundTopics,
    },
  });

  for (const command of profile.commands) {
    const params = Array.from(extractParameters(command.payloadTemplate)).sort();
    capabilities.push({
      key: normalizeKey(command.key, command.message.id),
      label: command.message.name ?? command.key,
      category: "command",
      transport,
      messageId: command.message.id,
      topic: command.topicTemplate,
      subTopic: command.subTopic,
      commandType: command.message.commandType ?? undefined,
      parameters: params,
      metadata: {
        messageType: command.message.messageType,
        policyType: command.message.policyType,
        communicationMethod: command.message.communicationMethod,
      },
    });
  }

  for (const message of profile.messages) {
    const commandType = getString(message.commandType);
    if (commandType) continue;

    capabilities.push({
      key: normalizeKey(message.name ?? message.id, message.id),
      label: message.name ?? message.id,
      category: "telemetry",
      transport,
      messageId: message.id,
      topic: message.topic,
      commandType: undefined,
      parameters: resolveExpectedFields(message),
      metadata: {
        messageType: message.messageType,
        policyType: message.policyType,
      },
    });
  }

  return capabilities;
}

export function deriveTelemetryProfiles(profile: CatalogProfile): TelemetryProfile[] {
  return profile.messages
    .filter((message) => !getString(message.commandType))
    .map((message) => {
      const parserMetadata = parseJsonObject(message.requestPayloadFormat);
      const parser =
        getString(parserMetadata.parser) ??
        getString(parserMetadata.normalizer) ??
        "default";
      const expectedFields = resolveExpectedFields(message);
      const resolvedTopic = message.topic
        .replace(/\{\{\s*thingId\s*\}\}/g, profile.thingId ?? profile.provisioning.thingName)
        .replace(/\{\{\s*thingName\s*\}\}/g, profile.thingName ?? profile.provisioning.thingName);

      return {
        messageId: message.id,
        name: message.name ?? message.id,
        topicTemplate: message.topic,
        resolvedTopic,
        parser,
        expectedFields,
        metadata: parserMetadata,
      };
    });
}
