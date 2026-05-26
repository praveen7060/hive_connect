import { prisma } from "../../config/prisma";
import { ApiError } from "../../middleware/error.middleware";

type JsonMap = Record<string, unknown>;
type DeviceRecord = NonNullable<Awaited<ReturnType<typeof prisma.device.findUnique>>>;
type ItemRecord = Awaited<ReturnType<typeof prisma.item.findFirst>>;
type CommunicationRecord = Awaited<ReturnType<typeof prisma.communication.findFirst>>;
type MessageRecord = NonNullable<Awaited<ReturnType<typeof prisma.message.findFirst>>>;
type VendorRecord = Awaited<ReturnType<typeof prisma.vendor.findFirst>>;

type CommandProfile = {
  key: string;
  message: MessageRecord;
  topicTemplate: string;
  subTopic?: string;
  payloadTemplate: JsonMap;
  confirmationPayloadTemplate: JsonMap;
  metadata: JsonMap;
};

export type CatalogProfile = {
  device: DeviceRecord;
  vendor: VendorRecord | null;
  item: ItemRecord | null;
  communication: CommunicationRecord | null;
  messages: MessageRecord[];
  commands: CommandProfile[];
  rawMetadata: JsonMap;
  catalogMetadata: JsonMap;
  iotMetadata: JsonMap;
  thingId?: string;
  thingName?: string;
  connectAdminDeviceId: string;
  provisioning: {
    deviceId: string;
    deviceType: string;
    thingName: string;
    policyName?: string;
    s3Prefix?: string;
    channels?: string;
    forceProvision?: boolean;
    attributes: Record<string, string>;
  };
  protocol: {
    transport: string;
    adapterKey: string;
    direction: string;
    authStrategy?: string;
    protocolName?: string;
    protocolVersion?: string;
    executionMode: string;
    inboundTopics: string[];
    metadata: JsonMap;
  };
};

function isPlainObject(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string | null | undefined): JsonMap {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getObject(value: unknown): JsonMap {
  return isPlainObject(value) ? value : {};
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeCommandKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || undefined;
}

function coerceRecordStringValues(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [key, typeof entryValue === "string" ? entryValue.trim() : String(entryValue ?? "")])
      .filter(([, entryValue]) => Boolean(entryValue))
  );
}

function getPathValue(source: unknown, path: string): unknown {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!isPlainObject(current)) return undefined;
      return current[segment];
    }, source);
}

function renderTemplateString(template: string, context: JsonMap): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawPath: string) => {
    const value = getPathValue(context, rawPath.trim());
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

function renderTemplateValue(value: unknown, context: JsonMap): unknown {
  if (typeof value === "string") {
    return renderTemplateString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderTemplateValue(entry, context));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, renderTemplateValue(entryValue, context)])
    );
  }

  return value;
}

function parseTemplateObject(value: string | null | undefined): JsonMap {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getCatalogLayer(rawMetadata: JsonMap, item: ItemRecord | null, communication: CommunicationRecord | null) {
  const deviceCatalog = getObject(rawMetadata.catalog);
  const itemCatalog = getObject(parseJsonObject(item?.metadata).catalog);
  const communicationCatalog = getObject(parseJsonObject(communication?.messageStructure).catalog);

  return {
    deviceCatalog,
    itemCatalog,
    communicationCatalog,
  };
}

async function resolveItem(device: DeviceRecord, catalogMetadata: JsonMap): Promise<ItemRecord | null> {
  const itemId = getString(catalogMetadata.itemId);
  if (itemId) {
    const direct = await prisma.item.findUnique({ where: { id: itemId } });
    if (direct) return direct;
  }

  const itemCode = getString(catalogMetadata.itemCode);
  if (itemCode) {
    const byCode = await prisma.item.findFirst({ where: { itemCode } });
    if (byCode) return byCode;
  }

  const itemName = getString(catalogMetadata.itemName);
  if (itemName) {
    const byName = await prisma.item.findFirst({ where: { name: itemName } });
    if (byName) return byName;
  }

  const metadataItemRef = getString(getObject(getObject(parseJsonObject(device.metadata)).catalog).item);
  if (metadataItemRef) {
    const byRef = await prisma.item.findFirst({
      where: {
        OR: [{ id: metadataItemRef }, { itemCode: metadataItemRef }, { name: metadataItemRef }],
      },
    });
    if (byRef) return byRef;
  }

  return null;
}

async function resolveVendor(item: ItemRecord | null, catalogMetadata: JsonMap): Promise<VendorRecord | null> {
  const vendorName =
    getString(catalogMetadata.vendorName) ??
    getString(catalogMetadata.vendor) ??
    getString(item?.vendor);

  if (!vendorName) {
    return null;
  }

  return prisma.vendor.findFirst({
    where: { name: vendorName },
  });
}

function buildCommandProfiles(
  messages: MessageRecord[],
  communication: CommunicationRecord | null,
  catalogMetadata: JsonMap,
  thingName: string | undefined
): CommandProfile[] {
  const commandMap = getObject(catalogMetadata.commands);
  const communicationTemplate = parseTemplateObject(communication?.messageStructure);
  const confirmationTemplate = parseTemplateObject(communication?.confirmationMessageStructure);

  return messages.map((message) => {
    const commandKeyCandidates = [
      normalizeCommandKey(getString(getObject(commandMap[message.id]).commandKey)),
      normalizeCommandKey(getString(message.commandType)),
      normalizeCommandKey(getString(message.name)),
      normalizeCommandKey(message.id),
    ].filter((value): value is string => Boolean(value));

    const commandMetadata =
      getObject(commandMap[commandKeyCandidates[0] ?? ""]) ||
      getObject(commandMap[message.id]) ||
      getObject(parseJsonObject(message.payloadFormat).command);

    const topicTemplate = getString(commandMetadata.topic) ?? getString(message.topic) ?? "";
    const resolvedTopic = thingName ? renderTemplateString(topicTemplate, { thingId: thingName, thingName }) : topicTemplate;
    const derivedSubTopic = (() => {
      const explicit = getString(commandMetadata.subTopic);
      if (explicit) return explicit;
      if (!thingName) return undefined;

      const prefixes = [`mqtt/device/${thingName}/`, `mqtt/device/{{thingId}}/`, `mqtt/device/{{thingName}}/`];
      const matchedPrefix = prefixes.find((prefix) => resolvedTopic.startsWith(prefix));
      if (!matchedPrefix) return undefined;
      return resolvedTopic.slice(matchedPrefix.length).trim() || undefined;
    })();

    return {
      key: commandKeyCandidates[0] ?? message.id,
      message,
      topicTemplate,
      subTopic: derivedSubTopic,
      payloadTemplate: {
        ...communicationTemplate,
        ...parseTemplateObject(message.payloadFormat),
        ...getObject(commandMetadata.payloadTemplate),
      },
      confirmationPayloadTemplate: {
        ...confirmationTemplate,
        ...parseTemplateObject(message.confirmationPayloadFormat),
        ...getObject(commandMetadata.confirmationPayloadTemplate),
      },
      metadata: commandMetadata,
    };
  });
}

export async function resolveCatalogProfile(deviceRecordId: string): Promise<CatalogProfile> {
  const device = await prisma.device.findUnique({ where: { id: deviceRecordId } });
  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  const rawMetadata = parseJsonObject(device.metadata);
  const catalogMetadata = getObject(rawMetadata.catalog);
  const iotMetadata = getObject(rawMetadata.iot);
  const item = await resolveItem(device, catalogMetadata);
  const vendor = await resolveVendor(item, catalogMetadata);

  const communicationPolicy =
    getString(catalogMetadata.communicationPolicy) ??
    getString(item?.communicationPolicy);

  const communication = communicationPolicy
    ? await prisma.communication.findFirst({ where: { name: communicationPolicy } })
    : null;

  const explicitMessageIds = getStringArray(catalogMetadata.messageIds);
  const itemType = getString(catalogMetadata.itemType) ?? getString(item?.itemType);

  const messages = explicitMessageIds.length
    ? await prisma.message.findMany({
        where: { id: { in: explicitMessageIds } },
        orderBy: { createdAt: "asc" },
      })
    : await prisma.message.findMany({
        where: {
          ...(communicationPolicy || itemType
            ? {
                AND: [
                  communicationPolicy ? { communicationPolicy } : {},
                  itemType ? { itemType } : {},
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      });

  const thingId =
    getString(iotMetadata.thingId) ??
    getString(device.foreignId) ??
    getString(catalogMetadata.thingId) ??
    undefined;

  const thingName =
    getString(iotMetadata.thingName) ??
    getString(catalogMetadata.thingName) ??
    thingId ??
    undefined;

  const layers = getCatalogLayer(rawMetadata, item, communication);
  const effectiveCatalog = {
    ...layers.communicationCatalog,
    ...layers.itemCatalog,
    ...layers.deviceCatalog,
  };

  const connectAdminDeviceId =
    getString(effectiveCatalog.connectAdminDeviceId) ??
    device.serialNumber ??
    thingId;

  const provisioningThingName =
    getString(effectiveCatalog.thingName) ??
    thingName ??
    device.serialNumber;

  const commands = buildCommandProfiles(messages, communication, effectiveCatalog, provisioningThingName);
  const communicationMetadata = parseJsonObject(communication?.metadata);
  const inboundTopics = Array.from(
    new Set(
      messages
        .filter((message) => !normalizeCommandKey(getString(message.commandType)))
        .map((message) => renderTemplateString(message.topic, {
          thingId: provisioningThingName,
          thingName: provisioningThingName,
          connectAdminDeviceId,
        }))
        .map((topic) => topic.trim())
        .filter(Boolean)
    )
  );
  const protocolName =
    getString(effectiveCatalog.protocol) ??
    getString(communicationMetadata.protocol) ??
    getString(communication?.protocol) ??
    "MQTT";
  const transport =
    getString(effectiveCatalog.transport) ??
    getString(communicationMetadata.transport) ??
    getString(communication?.transport) ??
    protocolName;
  const adapterKey =
    getString(effectiveCatalog.adapterKey) ??
    getString(communicationMetadata.adapterKey) ??
    (transport.toLowerCase().includes("http") ? "http-vendor" : "mqtt-aws-iot");
  const executionMode =
    getString(effectiveCatalog.executionMode) ??
    getString(communicationMetadata.executionMode) ??
    "request-response";

  return {
    device,
    vendor,
    item,
    communication,
    messages,
    commands,
    rawMetadata,
    catalogMetadata: effectiveCatalog,
    iotMetadata,
    thingId,
    thingName,
    connectAdminDeviceId,
    provisioning: {
      deviceId: connectAdminDeviceId,
      deviceType:
        getString(effectiveCatalog.deviceType) ??
        getString(device.connectionType) ??
        "GENERIC",
      thingName: provisioningThingName,
      policyName: getString(effectiveCatalog.policyName),
      s3Prefix: getString(effectiveCatalog.s3Prefix),
      channels: getString(effectiveCatalog.channels),
      forceProvision: Boolean(effectiveCatalog.forceProvision),
      attributes: {
        serialNumber: device.serialNumber,
        displayName: device.name,
        project: device.project,
        connectionType: device.connectionType,
        ...coerceRecordStringValues(effectiveCatalog.attributes),
      },
    },
    protocol: {
      transport,
      adapterKey,
      direction:
        getString(effectiveCatalog.direction) ??
        getString(communicationMetadata.direction) ??
        "bidirectional",
      authStrategy:
        getString(effectiveCatalog.authStrategy) ??
        getString(communicationMetadata.authStrategy) ??
        getString(vendor?.authType),
      protocolName,
      protocolVersion:
        getString(effectiveCatalog.protocolVersion) ??
        getString(communicationMetadata.protocolVersion) ??
        getString(communication?.version),
      executionMode,
      inboundTopics,
      metadata: {
        ...communicationMetadata,
        ...getObject(effectiveCatalog.protocolMetadata),
      },
    },
  };
}

export function renderTopicTemplate(template: string, context: JsonMap): string {
  return renderTemplateString(template, context);
}

export function renderPayloadTemplate(template: JsonMap, context: JsonMap): JsonMap {
  const rendered = renderTemplateValue(template, context);
  return isPlainObject(rendered) ? rendered : {};
}

export function buildTemplateContext(
  profile: CatalogProfile,
  params: Record<string, unknown>,
  payload: Record<string, unknown>
): JsonMap {
  return {
    device: {
      ...profile.device,
      metadata: profile.rawMetadata,
    },
    item: profile.item ?? {},
    communication: profile.communication ?? {},
    iot: profile.iotMetadata,
    catalog: profile.catalogMetadata,
    thingId: profile.thingId ?? profile.provisioning.thingName,
    thingName: profile.thingName ?? profile.provisioning.thingName,
    connectAdminDeviceId: profile.connectAdminDeviceId,
    params,
    payload,
  };
}
