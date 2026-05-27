import { prisma } from "../../config/prisma";

type JsonMap = Record<string, unknown>;

type ExtractedParameter = {
  name: string;
  variableType: string;
  sampleValue?: string;
  isConstant: boolean;
  scope: string;
};

type ExtractedRequest = {
  name: string;
  method: string;
  path: string;
  query: Array<{ key: string; value?: string }>;
  headers: Array<{ key: string; value?: string }>;
  bodyRaw?: string;
  bodyFields: ExtractedParameter[];
};

type PostmanUrl = {
  raw?: string;
  path?: string[];
  query?: Array<{ key?: string; value?: string }>;
};

type PostmanRequest = {
  method?: string;
  header?: Array<{ key?: string; value?: string }>;
  body?: { mode?: string; raw?: string };
  url?: string | PostmanUrl;
};

type PostmanItem = {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
};

type PostmanCollection = {
  info?: {
    name?: string;
    description?: string;
  };
  item?: PostmanItem[];
  event?: Array<{
    listen?: string;
    script?: { exec?: string[] };
  }>;
  variable?: Array<{
    key?: string;
    value?: string;
  }>;
};

function isPlainObject(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyToUndefined(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeCommandType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "request";
}

function normalizeVendorName(value: string) {
  const cleaned = value
    .replace(/\s*-\s*production.*$/i, "")
    .replace(/\s*api.*$/i, "")
    .replace(/[^\w\s&/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Imported Vendor";
}

function inferVariableType(value: string | undefined) {
  const normalized = emptyToUndefined(value)?.replace(/^["']|["']$/g, "");

  if (!normalized) return "STRING";
  if (/^(true|false)$/i.test(normalized)) return "BOOLEAN";
  if (/^-?\d+$/.test(normalized)) return "INTEGER";
  if (/^-?\d+\.\d+$/.test(normalized)) return "FLOAT";
  if (
    (normalized.startsWith("{") && normalized.endsWith("}")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    return "JSON";
  }

  return "STRING";
}

function isLikelyConstant(name: string) {
  return /(token|secret|key|client|device_id|uid|grant_type|base_url|host|timestamp|sign|cert|private|public)/i.test(
    name
  );
}

function isLikelyParameterToken(value: string) {
  return /^\{\{[^}]+\}\}$/.test(value.trim());
}

function extractTemplateTokens(value: string) {
  return Array.from(value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))
    .map((match) => normalizeName(match[1] ?? ""))
    .filter(Boolean);
}

function addParameter(
  target: Map<string, ExtractedParameter>,
  entry: ExtractedParameter
) {
  const key = entry.name.toLowerCase();
  if (!key) return;

  const existing = target.get(key);
  if (existing) {
    if (!existing.sampleValue && entry.sampleValue) {
      existing.sampleValue = entry.sampleValue;
    }
    existing.isConstant = existing.isConstant || entry.isConstant;
    existing.scope = existing.scope.includes(entry.scope)
      ? existing.scope
      : `${existing.scope},${entry.scope}`;
    return;
  }

  target.set(key, entry);
}

function extractJsonFields(
  value: unknown,
  parameters: Map<string, ExtractedParameter>,
  pathPrefix = ""
) {
  if (!isPlainObject(value)) {
    return [];
  }

  const extracted: ExtractedParameter[] = [];

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const fieldName = normalizeName(pathPrefix ? `${pathPrefix}_${rawKey}` : rawKey);
    if (!fieldName) continue;

    const sampleValue =
      typeof rawValue === "string"
        ? rawValue
        : Array.isArray(rawValue) || isPlainObject(rawValue)
          ? JSON.stringify(rawValue)
          : rawValue === null || rawValue === undefined
            ? undefined
            : String(rawValue);

    const parameter: ExtractedParameter = {
      name: fieldName,
      variableType: inferVariableType(sampleValue),
      sampleValue,
      isConstant: isLikelyConstant(fieldName),
      scope: "body",
    };

    extracted.push(parameter);
    addParameter(parameters, parameter);

    if (typeof rawValue === "string" && isLikelyParameterToken(rawValue)) {
      for (const token of extractTemplateTokens(rawValue)) {
        addParameter(parameters, {
          name: token,
          variableType: "STRING",
          sampleValue: rawValue,
          isConstant: isLikelyConstant(token),
          scope: "template",
        });
      }
    }

    if (isPlainObject(rawValue)) {
      extractJsonFields(rawValue, parameters, fieldName);
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const entry of rawValue) {
        if (isPlainObject(entry)) {
          extractJsonFields(entry, parameters, fieldName);
          continue;
        }

        const sampleEntry =
          typeof entry === "string"
            ? entry
            : entry === null || entry === undefined
              ? undefined
              : String(entry);
        addParameter(parameters, {
          name: normalizeName(`${fieldName}_item`),
          variableType: inferVariableType(sampleEntry),
          sampleValue: sampleEntry,
          isConstant: isLikelyConstant(fieldName),
          scope: "body",
        });
      }
    }
  }

  return extracted;
}

function parseBodyFields(bodyRaw: string | undefined, parameters: Map<string, ExtractedParameter>) {
  const trimmed = emptyToUndefined(bodyRaw);
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return extractJsonFields(parsed, parameters);
  } catch {
    for (const token of extractTemplateTokens(trimmed)) {
      addParameter(parameters, {
        name: token,
        variableType: "STRING",
        sampleValue: trimmed,
        isConstant: isLikelyConstant(token),
        scope: "template",
      });
    }
    return [];
  }
}

function stringifyUrl(url: string | PostmanUrl | undefined) {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;

  const path = Array.isArray(url.path) ? `/${url.path.join("/")}` : "";
  const query = (url.query ?? [])
    .filter((entry) => entry?.key)
    .map((entry) => `${entry.key}=${entry.value ?? ""}`)
    .join("&");
  return `${path}${query ? `?${query}` : ""}`;
}

function extractPathFromUrl(rawUrl: string) {
  try {
    const candidate = rawUrl.replace(/^\{\{base_url\}\}/, "https://placeholder.local");
    const url = new URL(candidate);
    return decodeURIComponent(`${url.pathname}${url.search}`);
  } catch {
    return rawUrl.replace(/^\{\{base_url\}\}/, "");
  }
}

function walkItems(items: PostmanItem[] | undefined, requests: ExtractedRequest[], parameters: Map<string, ExtractedParameter>) {
  for (const item of items ?? []) {
    if (Array.isArray(item.item) && item.item.length > 0) {
      walkItems(item.item, requests, parameters);
      continue;
    }

    if (!item.request) continue;

    const method = emptyToUndefined(item.request.method)?.toUpperCase() ?? "GET";
    const urlString = stringifyUrl(item.request.url);
    const path = extractPathFromUrl(urlString);
    const query = isPlainObject(item.request.url)
      ? (item.request.url.query ?? [])
          .filter((entry) => entry?.key)
          .map((entry) => ({ key: String(entry.key), value: entry.value }))
      : [];
    const headers = (item.request.header ?? [])
      .filter((entry) => entry?.key)
      .map((entry) => ({ key: String(entry.key), value: entry.value }));
    const bodyRaw = item.request.body?.mode === "raw" ? item.request.body.raw : undefined;
    const bodyFields = parseBodyFields(bodyRaw, parameters);

    for (const token of extractTemplateTokens(urlString)) {
      addParameter(parameters, {
        name: token,
        variableType: "STRING",
        sampleValue: urlString,
        isConstant: isLikelyConstant(token),
        scope: "path",
      });
    }

    for (const entry of query) {
      const normalizedKey = normalizeName(entry.key);
      addParameter(parameters, {
        name: normalizedKey,
        variableType: inferVariableType(entry.value),
        sampleValue: entry.value,
        isConstant: isLikelyConstant(normalizedKey),
        scope: "query",
      });

      if (entry.value && isLikelyParameterToken(entry.value)) {
        for (const token of extractTemplateTokens(entry.value)) {
          addParameter(parameters, {
            name: token,
            variableType: "STRING",
            sampleValue: entry.value,
            isConstant: isLikelyConstant(token),
            scope: "query",
          });
        }
      }
    }

    for (const entry of headers) {
      const normalizedKey = normalizeName(entry.key);
      addParameter(parameters, {
        name: normalizedKey,
        variableType: inferVariableType(entry.value),
        sampleValue: entry.value,
        isConstant: isLikelyConstant(normalizedKey),
        scope: "header",
      });

      if (entry.value && isLikelyParameterToken(entry.value)) {
        for (const token of extractTemplateTokens(entry.value)) {
          addParameter(parameters, {
            name: token,
            variableType: "STRING",
            sampleValue: entry.value,
            isConstant: isLikelyConstant(token),
            scope: "header",
          });
        }
      }
    }

    requests.push({
      name: emptyToUndefined(item.name) ?? `${method} ${path}`,
      method,
      path,
      query,
      headers,
      bodyRaw,
      bodyFields,
    });
  }
}

function deriveAuthType(collection: PostmanCollection) {
  const scriptText = (collection.event ?? [])
    .flatMap((event) => event.script?.exec ?? [])
    .join("\n");

  if (/HMAC-SHA256/i.test(scriptText)) return "hmac_sha256";
  if (/access_token/i.test(scriptText)) return "access_token";
  return "api_key";
}

function deriveTokenUrl(requests: ExtractedRequest[]) {
  const tokenRequest = requests.find((request) => /token/i.test(request.name) || /\/token\b/i.test(request.path));
  return tokenRequest?.path;
}

async function ensureCommunication(
  vendorName: string,
  itemTypeName: string,
  collection: PostmanCollection,
  requests: ExtractedRequest[]
) {
  const communicationName = `${vendorName.toUpperCase().replace(/\s+/g, "_")}_REST_API`;
  const tokenUrl = deriveTokenUrl(requests);
  const baseUrl = (collection.variable ?? []).find((entry) => entry.key === "base_url")?.value;
  const existing = await prisma.communication.findFirst({
    where: { name: communicationName },
  });

  const data = {
    name: communicationName,
    groupName: vendorName,
    itemType: itemTypeName,
    protocol: "HTTPS",
    version: "1.0",
    messageFormat: "JSON",
    communicationMethod: "REST",
    centric: "ENDPOINT",
    icon: "cloud",
    needFirmware: false,
    needConfirmation: true,
    format: "JSON",
    transport: "HTTPS",
    messageStructure: JSON.stringify(
      {
        baseUrl,
        tokenUrl,
        authType: deriveAuthType(collection),
      },
      null,
      2
    ),
    confirmationMessageStructure: JSON.stringify({}, null, 2),
    metadata: JSON.stringify(
      {
        importedFrom: "postman_collection",
        requestCount: requests.length,
      },
      null,
      2
    ),
    image: undefined,
  };

  if (existing) {
    return prisma.communication.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.communication.create({ data });
}

async function ensureItemType(vendorName: string) {
  const name = `${vendorName} API Device`;
  const existing = await prisma.itemType.findFirst({
    where: { name },
  });

  const data = {
    name,
    description: `Dynamic API-backed device profile for ${vendorName}.`,
    vendorName,
    synonyms: `${vendorName},API,REST`,
  };

  if (existing) {
    return prisma.itemType.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.itemType.create({ data });
}

async function ensureItem(vendorName: string, itemTypeName: string, communicationPolicy: string) {
  const itemCode = `${vendorName.toUpperCase().replace(/\s+/g, "_")}_API_DEVICE`;
  const existing = await prisma.item.findFirst({
    where: { itemCode },
  });

  const data = {
    name: `${vendorName} API Device`,
    itemCode,
    description: `Auto-imported catalog item for ${vendorName} API integration.`,
    vendor: vendorName,
    itemType: itemTypeName,
    communicationPolicy,
    componentCount: 1,
    secureItem: true,
    metadata: JSON.stringify(
      {
        catalog: {
          vendorName,
          itemType: itemTypeName,
          communicationPolicy,
          source: "postman_collection",
        },
      },
      null,
      2
    ),
  };

  if (existing) {
    return prisma.item.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.item.create({ data });
}

async function ensureMessages(itemTypeName: string, communicationPolicy: string, requests: ExtractedRequest[]) {
  let created = 0;
  let updated = 0;

  for (const request of requests) {
    const existing = await prisma.message.findFirst({
      where: {
        itemType: itemTypeName,
        communicationPolicy,
        topic: request.path,
        commandType: normalizeCommandType(`${request.method}_${request.name}`),
      },
    });

    const data = {
      name: request.name,
      itemType: itemTypeName,
      communicationPolicy,
      topic: request.path,
      messageType: request.method,
      commandType: normalizeCommandType(`${request.method}_${request.name}`),
      policyType: request.method === "GET" ? "QUERY" : "EXECUTE",
      communicationMethod: "REST",
      topicUnique: /\{\{[^}]+\}\}/.test(request.path),
      isPayloadCentric: Boolean(request.bodyRaw),
      retainMessages: false,
      loggedMessage: true,
      qos: 1,
      requestPayloadFormat: request.bodyRaw,
      responsePayloadFormat: undefined,
      payloadFormat: request.bodyRaw,
      notes: JSON.stringify(
        {
          method: request.method,
          headers: request.headers,
          query: request.query,
          bodyFields: request.bodyFields.map((field) => field.name),
        },
        null,
        2
      ),
    };

    if (existing) {
      await prisma.message.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
      continue;
    }

    await prisma.message.create({ data });
    created += 1;
  }

  return { created, updated };
}

async function ensureParameters(vendorName: string, parameters: ExtractedParameter[]) {
  let created = 0;
  let updated = 0;

  for (const parameter of parameters) {
    const existing = await prisma.parameter.findFirst({
      where: {
        name: parameter.name,
        vendors: vendorName,
      },
    });

    const data = {
      name: parameter.name,
      vendors: vendorName,
      variableType: parameter.variableType,
      pinType: parameter.scope,
      pinCount: 0,
      isConstant: parameter.isConstant,
    };

    if (existing) {
      await prisma.parameter.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
      continue;
    }

    await prisma.parameter.create({ data });
    created += 1;
  }

  return { created, updated };
}

export async function importVendorFromPostmanCollection(input: {
  fileName: string;
  buffer: Buffer;
  vendorName?: string;
  persist?: boolean;
}) {
  const rawText = input.buffer.toString("utf-8");
  const collection = JSON.parse(rawText) as PostmanCollection;
  const parameters = new Map<string, ExtractedParameter>();
  const requests: ExtractedRequest[] = [];

  for (const variable of collection.variable ?? []) {
    const key = normalizeName(variable.key ?? "");
    if (!key) continue;

    addParameter(parameters, {
      name: key,
      variableType: inferVariableType(variable.value),
      sampleValue: variable.value,
      isConstant: isLikelyConstant(key),
      scope: "collection",
    });
  }

  walkItems(collection.item, requests, parameters);

  const vendorName = emptyToUndefined(input.vendorName)
    ?? normalizeVendorName(collection.info?.name ?? input.fileName.replace(/\.postman_collection\.json$/i, ""));
  const itemTypeName = `${vendorName} API Device`;
  const authType = deriveAuthType(collection);
  const baseUrl = (collection.variable ?? []).find((entry) => entry.key === "base_url")?.value;
  const tokenUrl = deriveTokenUrl(requests);

  const preview = {
    vendorName,
    authType,
    baseUrl,
    tokenUrl,
    parameters: Array.from(parameters.values()).sort((a, b) => a.name.localeCompare(b.name)),
    requests,
  };

  if (input.persist === false) {
    return {
      ...preview,
      persisted: false,
    };
  }

  const vendorData = {
    name: vendorName,
    description: collection.info?.description,
    type: "cloud_api_vendor",
    industry: "iot",
    protocol: "API",
    status: "active",
    uid: parameters.get("uid")?.sampleValue,
    baseUrl,
    apiVersion: requests.find((request) => /\/v\d+\.\d+/i.test(request.path))?.path.match(/\/(v\d+\.\d+)/i)?.[1],
    authType,
    clientId: parameters.get("client_id")?.sampleValue,
    clientSecret: parameters.get("client_secret")?.sampleValue,
    authorizationUrl: baseUrl,
    tokenUrl,
    apiToken: parameters.get("access_token")?.sampleValue,
    tokenType: parameters.has("access_token") ? "access_token" : undefined,
    notes: "Imported from Postman collection",
  };

  const existingVendor = await prisma.vendor.findFirst({
    where: { name: vendorName },
  });

  const vendor = existingVendor
    ? await prisma.vendor.update({
        where: { id: existingVendor.id },
        data: vendorData,
      })
    : await prisma.vendor.create({
        data: vendorData,
      });

  const itemType = await ensureItemType(vendorName);
  const communication = await ensureCommunication(vendorName, itemTypeName, collection, requests);
  const item = await ensureItem(vendorName, itemType.name, communication.name);
  const parameterResult = await ensureParameters(vendorName, preview.parameters);
  const messageResult = await ensureMessages(itemType.name, communication.name, requests);

  return {
    ...preview,
    persisted: true,
    vendor,
    itemType,
    communication,
    item,
    summary: {
      parameterCreated: parameterResult.created,
      parameterUpdated: parameterResult.updated,
      messageCreated: messageResult.created,
      messageUpdated: messageResult.updated,
      requestCount: requests.length,
      parameterCount: preview.parameters.length,
    },
  };
}
