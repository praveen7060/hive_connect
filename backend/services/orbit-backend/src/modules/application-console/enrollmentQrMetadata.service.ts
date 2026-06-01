import { ApiError } from "../../middleware/error.middleware";
import {
  buildTemplateContext,
  renderPayloadTemplate,
  renderTopicTemplate,
  resolveCatalogProfile,
  type CatalogProfile,
} from "../iot-orchestration/catalog-resolver";

type JsonMap = Record<string, unknown>;

type CertificateReference = {
  source: "asset" | "iot";
  version?: number | null;
  thingId?: string | null;
  certificateId?: string | null;
  certificateArn?: string | null;
  bucket?: string | null;
  region?: string | null;
  certificateKey?: string | null;
  privateKeyKey?: string | null;
  publicKeyKey?: string | null;
  metadataKey?: string | null;
  documents?: JsonMap;
};

type ParameterPinRecord = {
  name: string;
  pinType?: string | null;
  pinCount?: number | null;
};

type ComponentSeed = {
  componentId: string;
  componentName: string;
  componentType: string;
  channel?: string;
  switchNo?: string;
  params: Record<string, unknown>;
  metadata?: JsonMap;
};

type ComponentAction = {
  actionKey: string;
  label: string;
  mqttTopic: string;
  payloadTemplate: JsonMap;
  policyId: string;
  policyName: string;
  communicationPolicy: string | null;
  commandType: string | null;
  policyType: string | null;
  messageType: string | null;
  subTopic: string | null;
};

type EnrollmentQrMetadataComponent = {
  componentId: string;
  componentName: string;
  componentType: string;
  channel?: string;
  switchNo?: string;
  params: Record<string, unknown>;
  metadata?: JsonMap;
  actions: ComponentAction[];
};

type MessagingPolicyReference = {
  policyId: string;
  policyName: string;
  communicationPolicy: string | null;
  topic: string;
  commandType: string | null;
  policyType: string | null;
  messageType: string | null;
};

export type EnrollmentQrMetadata = {
  deviceId: string;
  serialNumber: string;
  thingId: string;
  itemType: string;
  communicationPolicy: string | null;
  claimStatus: string;
  generatedAt: string;
  qrVersion: number;
  s3QrPath: string | null;
  item: {
    id: string | null;
    name: string | null;
    itemCode: string | null;
    componentCount: number;
  };
  components: EnrollmentQrMetadataComponent[];
  configuredActions: {
    total: number;
    groupedByComponent: EnrollmentQrMetadataComponent[];
  };
  messagingPolicyReferences: MessagingPolicyReference[];
  certificateReferences: CertificateReference[];
};

export type PrepareEnrollmentQrMetadataDeps = {
  loadCatalogProfile: (deviceId: string) => Promise<CatalogProfile>;
  loadParameterPinMappings: (candidateNames: string[]) => Promise<ParameterPinRecord[]>;
  loadCertificateReferences: (deviceId: string) => Promise<CertificateReference[]>;
  logger?: (event: string, details: Record<string, unknown>) => void;
};

function isPlainObject(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function inferComponentCountFromChannels(value: string | undefined) {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d+)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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

function normalizeKey(value: string | undefined, fallback: string) {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractTemplateParameterNames(template: unknown, acc = new Set<string>()) {
  if (typeof template === "string") {
    for (const match of template.matchAll(/\{\{\s*params\.([^}\s]+)\s*\}\}/g)) {
      acc.add(match[1]);
    }
    return acc;
  }

  if (Array.isArray(template)) {
    template.forEach((entry) => extractTemplateParameterNames(entry, acc));
    return acc;
  }

  if (isPlainObject(template)) {
    Object.values(template).forEach((entry) => extractTemplateParameterNames(entry, acc));
  }

  return acc;
}

function candidateComponentArrays(profile: CatalogProfile, itemMetadata: JsonMap) {
  const catalog = profile.catalogMetadata;
  const candidates = [
    catalog.components,
    catalog.componentDefinitions,
    itemMetadata.components,
    itemMetadata.componentDefinitions,
  ];

  return candidates.filter(Array.isArray);
}

function inferChannelCount(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^(\d+)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildExplicitComponents(profile: CatalogProfile, itemMetadata: JsonMap, logger?: PrepareEnrollmentQrMetadataDeps["logger"]) {
  const arrays = candidateComponentArrays(profile, itemMetadata);
  const components: ComponentSeed[] = [];

  arrays.forEach((candidateArray) => {
    candidateArray.forEach((entry, entryIndex) => {
      if (!isPlainObject(entry)) return;
      const componentType =
        getString(entry.componentType) ??
        getString(entry.type) ??
        getString(entry.kind);
      if (!componentType) return;

      const count = Math.max(1, getNumber(entry.count) ?? 1);
      const baseName = getString(entry.componentName) ?? getString(entry.name) ?? titleize(componentType);
      const baseParams = isPlainObject(entry.params) ? entry.params : {};
      for (let index = 0; index < count; index += 1) {
        const ordinal = count > 1 ? index + 1 : undefined;
        const switchNo = getString(baseParams.switchNo) ?? getString(baseParams.switch_no) ?? (componentType.toLowerCase().includes("relay") || componentType.toLowerCase().includes("switch") ? `S${index + 1}` : undefined);
        const channel = getString(baseParams.channel) ?? (ordinal ? String(ordinal) : undefined);
        components.push({
          componentId:
            getString(entry.componentId) ??
            `${profile.device.id}:${normalizeKey(componentType, "component")}:${entryIndex}:${index + 1}`,
          componentName: ordinal ? `${baseName} ${ordinal}` : baseName,
          componentType,
          channel,
          switchNo,
          params: {
            ...baseParams,
            ...(channel ? { channel } : {}),
            ...(switchNo ? { switchNo, switch_no: switchNo } : {}),
          },
          metadata: entry,
        });
      }
    });
  });

  if (components.length > 0) {
    logger?.("components_explicitly_resolved", {
      deviceId: profile.device.id,
      count: components.length,
    });
  }

  return components;
}

function inferFallbackComponentType(parameterMappings: ParameterPinRecord[], commandParams: Set<string>) {
  const pinTypes = parameterMappings.map((entry) => (entry.pinType ?? "").trim().toLowerCase()).filter(Boolean);
  const names = parameterMappings.map((entry) => normalizeKey(entry.name, entry.name));
  const normalizedCommandParams = Array.from(commandParams).map((entry) => normalizeKey(entry, entry));

  if (
    pinTypes.includes("relay") ||
    pinTypes.includes("switch") ||
    names.includes("switch_no") ||
    normalizedCommandParams.includes("switchno") ||
    normalizedCommandParams.includes("switch_no")
  ) {
    return "relay";
  }

  if (
    pinTypes.includes("meter") ||
    names.includes("meter") ||
    normalizedCommandParams.includes("meter")
  ) {
    return "meter";
  }

  if (pinTypes.includes("channel") || normalizedCommandParams.includes("channel")) {
    return "channel";
  }

  return undefined;
}

function buildGeneratedComponents(
  profile: CatalogProfile,
  itemType: string,
  parameterMappings: ParameterPinRecord[],
  logger?: PrepareEnrollmentQrMetadataDeps["logger"]
) {
  const itemMetadata = parseJsonObject(profile.item?.metadata);
  const explicitComponentType =
    getString(profile.catalogMetadata.componentType) ??
    getString(itemMetadata.componentType);

  const commandParams = profile.commands.reduce((acc, command) => extractTemplateParameterNames(command.payloadTemplate, acc), new Set<string>());
  const componentType = explicitComponentType ?? inferFallbackComponentType(parameterMappings, commandParams);
  if (!componentType) {
    throw new ApiError(422, `Component type mapping is missing for item type '${itemType}'`);
  }

  const componentCount =
    getNumber(profile.catalogMetadata.componentCount) ??
    inferComponentCountFromChannels(getString(profile.catalogMetadata.channels)) ??
    inferChannelCount(getString(profile.provisioning.channels)) ??
    profile.item?.componentCount;
  if (!componentCount || componentCount <= 0) {
    throw new ApiError(422, `Components are missing for item type '${itemType}'`);
  }

  const hasSwitchParam = Array.from(commandParams).some((entry) =>
    ["switchno", "switch_no"].includes(normalizeKey(entry, entry))
  );
  const hasChannelParam = Array.from(commandParams).some((entry) =>
    normalizeKey(entry, entry) === "channel"
  );

  const components = Array.from({ length: componentCount }, (_, index) => {
    const channel = hasChannelParam ? String(index + 1) : undefined;
    const switchNo = hasSwitchParam ? `S${index + 1}` : undefined;
    return {
      componentId: `${profile.device.id}:${normalizeKey(componentType, "component")}:${index + 1}`,
      componentName: `${titleize(componentType)} ${index + 1}`,
      componentType,
      channel,
      switchNo,
      params: {
        ...(channel ? { channel } : {}),
        ...(switchNo ? { switchNo, switch_no: switchNo } : {}),
      },
      metadata: {
        generated: true,
        itemType,
      },
    } satisfies ComponentSeed;
  });

  logger?.("components_generated_from_item_config", {
    deviceId: profile.device.id,
    componentType,
    componentCount,
  });

  return components;
}

function dedupeActions(actions: ComponentAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.actionKey}|${action.policyId}|${action.mqttTopic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildActionsForComponents(
  profile: CatalogProfile,
  components: ComponentSeed[],
  logger?: PrepareEnrollmentQrMetadataDeps["logger"]
) {
  const grouped = components.map((component) => {
    const actions = profile.commands.flatMap((command) => {
      const requiredParams = Array.from(extractTemplateParameterNames(command.payloadTemplate)).map((entry) => normalizeKey(entry, entry));
      const explicitComponentType = getString(command.metadata.componentType);
      if (explicitComponentType && normalizeKey(explicitComponentType, explicitComponentType) !== normalizeKey(component.componentType, component.componentType)) {
        return [];
      }

      if (requiredParams.includes("switch_no") && !component.switchNo) return [];
      if (requiredParams.includes("switchno") && !component.switchNo) return [];
      if (requiredParams.includes("channel") && !component.channel) return [];

      const context = buildTemplateContext(profile, component.params, {});
      return [
        {
          actionKey: normalizeKey(command.key, command.message.id).toUpperCase(),
          label: command.message.name ?? titleize(command.key),
          mqttTopic: renderTopicTemplate(command.topicTemplate, context),
          payloadTemplate: renderPayloadTemplate(command.payloadTemplate, context),
          policyId: command.message.id,
          policyName: command.message.name ?? command.message.id,
          communicationPolicy: profile.communication?.name ?? null,
          commandType: command.message.commandType ?? null,
          policyType: command.message.policyType ?? null,
          messageType: command.message.messageType ?? null,
          subTopic: command.subTopic ?? null,
        } satisfies ComponentAction,
      ];
    });

    return {
      componentId: component.componentId,
      componentName: component.componentName,
      componentType: component.componentType,
      channel: component.channel,
      switchNo: component.switchNo,
      params: component.params,
      metadata: component.metadata,
      actions: dedupeActions(actions),
    } satisfies EnrollmentQrMetadataComponent;
  });

  logger?.("component_actions_resolved", {
    deviceId: profile.device.id,
    componentCount: grouped.length,
    actionCount: grouped.reduce((sum, component) => sum + component.actions.length, 0),
  });

  return grouped;
}

function buildMessagingPolicyReferences(profile: CatalogProfile): MessagingPolicyReference[] {
  const references = profile.commands.map((command) => ({
    policyId: command.message.id,
    policyName: command.message.name ?? command.message.id,
    communicationPolicy: profile.communication?.name ?? null,
    topic: command.topicTemplate,
    commandType: command.message.commandType ?? null,
    policyType: command.message.policyType ?? null,
    messageType: command.message.messageType ?? null,
  }));

  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.policyId}|${reference.commandType ?? ""}|${reference.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildEnrollmentQrMetadata(args: {
  profile: CatalogProfile;
  parameterMappings: ParameterPinRecord[];
  certificateReferences: CertificateReference[];
  qrVersion: number;
  generatedAt: string;
  claimStatus: string;
  s3QrPath: string | null;
  logger?: PrepareEnrollmentQrMetadataDeps["logger"];
}): EnrollmentQrMetadata {
  const { profile, parameterMappings, certificateReferences, qrVersion, generatedAt, claimStatus, s3QrPath, logger } = args;
  const itemType =
    getString(profile.item?.itemType) ??
    getString(profile.catalogMetadata.itemType);
  if (!itemType) {
    throw new ApiError(422, "Item type is missing for device claim QR generation");
  }

  const itemMetadata = parseJsonObject(profile.item?.metadata);
  const explicitComponents = buildExplicitComponents(profile, itemMetadata, logger);
  const componentSeeds =
    explicitComponents.length > 0
      ? explicitComponents
      : buildGeneratedComponents(profile, itemType, parameterMappings, logger);

  if (componentSeeds.length === 0) {
    throw new ApiError(422, `Components are missing for item type '${itemType}'`);
  }

  const components = buildActionsForComponents(profile, componentSeeds, logger);
  const thingId = profile.thingId ?? profile.thingName ?? profile.provisioning.thingName;
  if (!thingId) {
    throw new ApiError(422, "Thing ID is missing for device claim QR generation");
  }

  return {
    deviceId: profile.device.id,
    serialNumber: profile.device.serialNumber,
    thingId,
    itemType,
    communicationPolicy: profile.communication?.name ?? null,
    claimStatus,
    generatedAt,
    qrVersion,
    s3QrPath,
    item: {
      id: profile.item?.id ?? null,
      name: profile.item?.name ?? null,
      itemCode: profile.item?.itemCode ?? null,
      componentCount:
        getNumber(profile.catalogMetadata.componentCount) ??
        inferComponentCountFromChannels(getString(profile.catalogMetadata.channels)) ??
        inferChannelCount(getString(profile.provisioning.channels)) ??
        profile.item?.componentCount ??
        componentSeeds.length,
    },
    components,
    configuredActions: {
      total: components.reduce((sum, component) => sum + component.actions.length, 0),
      groupedByComponent: components,
    },
    messagingPolicyReferences: buildMessagingPolicyReferences(profile),
    certificateReferences,
  };
}

export async function prepareEnrollmentQrMetadata(
  deviceId: string,
  input: {
    qrVersion: number;
    generatedAt: string;
    claimStatus: string;
    s3QrPath?: string | null;
  },
  deps: PrepareEnrollmentQrMetadataDeps
) {
  deps.logger?.("qr_metadata_resolution_started", {
    deviceId,
    qrVersion: input.qrVersion,
  });

  const profile = await deps.loadCatalogProfile(deviceId);
  deps.logger?.("qr_metadata_profile_loaded", {
    deviceId,
    itemId: profile.item?.id ?? null,
    itemType: profile.item?.itemType ?? profile.catalogMetadata.itemType ?? null,
    commandCount: profile.commands.length,
  });

  const candidateParameterNames = Array.from(
    profile.commands.reduce((acc, command) => extractTemplateParameterNames(command.payloadTemplate, acc), new Set<string>())
  ).map((entry) => normalizeKey(entry, entry));

  const parameterMappings = await deps.loadParameterPinMappings(candidateParameterNames);
  deps.logger?.("qr_metadata_parameter_mappings_loaded", {
    deviceId,
    candidateCount: candidateParameterNames.length,
    matchedCount: parameterMappings.length,
  });

  const certificateReferences = await deps.loadCertificateReferences(deviceId);
  deps.logger?.("qr_metadata_certificate_references_loaded", {
    deviceId,
    certificateReferenceCount: certificateReferences.length,
  });

  const metadata = buildEnrollmentQrMetadata({
    profile,
    parameterMappings,
    certificateReferences,
    qrVersion: input.qrVersion,
    generatedAt: input.generatedAt,
    claimStatus: input.claimStatus,
    s3QrPath: input.s3QrPath ?? null,
    logger: deps.logger,
  });

  deps.logger?.("qr_metadata_resolution_succeeded", {
    deviceId,
    components: metadata.components.length,
    actionCount: metadata.configuredActions.total,
  });

  return metadata;
}

export async function defaultPrepareEnrollmentQrMetadata(
  deviceId: string,
  input: {
    qrVersion: number;
    generatedAt: string;
    claimStatus: string;
    s3QrPath?: string | null;
  }
) {
  return prepareEnrollmentQrMetadata(
    deviceId,
    input,
    {
      loadCatalogProfile: resolveCatalogProfile,
      loadParameterPinMappings: async (_candidateNames) => {
        const { prisma } = await import("../../config/prisma");
        const normalizedCandidates = new Set(
          _candidateNames.flatMap((entry) => {
            const normalized = normalizeKey(entry, entry);
            return [normalized, normalized.replace(/switchno/g, "switch_no")];
          })
        );
        const all = await prisma.parameter.findMany({
          select: { name: true, pinType: true, pinCount: true },
        });
        return all.filter((entry) => normalizedCandidates.has(normalizeKey(entry.name, entry.name)));
      },
      loadCertificateReferences: async (_deviceId) => {
        const { prisma } = await import("../../config/prisma");
        const assets = await prisma.deviceCertificateAsset.findMany({
          where: { deviceId: _deviceId },
          orderBy: { createdAt: "desc" },
        });
        return assets.map((asset) => ({
          source: "asset" as const,
          version: asset.version,
          thingId: asset.thingId,
          certificateId: asset.certificateId,
          certificateArn: asset.certificateArn,
          bucket: asset.bucket,
          region: asset.region,
          certificateKey: asset.certificateKey,
          privateKeyKey: asset.privateKeyKey,
          publicKeyKey: asset.publicKeyKey,
          metadataKey: asset.metadataKey,
        }));
      },
      logger: (event, details) =>
        console.log(
          JSON.stringify({
            scope: "orbit.enrollment-qr",
            event,
            timestamp: new Date().toISOString(),
            ...details,
          })
        ),
    }
  );
}
