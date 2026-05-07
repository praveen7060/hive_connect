import { prisma } from "../../config/prisma";
import { PDFParse } from "pdf-parse";

type ExtractedParameter = {
  name: string;
  variableType: string;
  sampleValue?: string;
  isConstant: boolean;
};

function normalizeParameterName(value: string) {
  return value.trim().replace(/["'`,]+/g, "").replace(/\s+/g, "_");
}

function inferVariableType(value: string) {
  const raw = value.trim();
  const normalized = raw.replace(/^["']|["']$/g, "");

  if (!normalized) return "STRING";
  if (/^(true|false)$/i.test(normalized)) return "BOOLEAN";
  if (/^-?\d+$/.test(normalized)) return "INTEGER";
  if (/^-?\d+\.\d+$/.test(normalized)) return "FLOAT";
  if ((normalized.startsWith("{") && normalized.endsWith("}")) || (normalized.startsWith("[") && normalized.endsWith("]"))) {
    return "JSON";
  }
  return "STRING";
}

function isLikelyConstant(name: string) {
  return /(firmware|version|mac|ip|secret|token|certificate|deviceid|thingid)/i.test(name);
}

function extractFromJsonLikeText(text: string) {
  const candidates = new Map<string, ExtractedParameter>();
  const regex = /["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*:\s*("[^"]*"|'[^']*'|true|false|-?\d+(?:\.\d+)?|\{[^{}]*\}|\[[^[\]]*\])/g;

  for (const match of text.matchAll(regex)) {
    const rawName = normalizeParameterName(match[1] ?? "");
    const rawValue = String(match[2] ?? "").trim();
    if (!rawName) continue;
    if (rawName.length < 2) continue;

    const existing = candidates.get(rawName);
    if (existing) continue;

    candidates.set(rawName, {
      name: rawName,
      variableType: inferVariableType(rawValue),
      sampleValue: rawValue.replace(/^["']|["']$/g, ""),
      isConstant: isLikelyConstant(rawName),
    });
  }

  return candidates;
}

function extractFromKeyValueLines(text: string, seed: Map<string, ExtractedParameter>) {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_\-/ ]{1,60})\s*[:=-]\s*([A-Za-z0-9_"'.\-[\]{} ]+)\s*$/);
    if (!match) continue;

    const rawName = normalizeParameterName(match[1] ?? "");
    const rawValue = String(match[2] ?? "").trim();
    if (!rawName || seed.has(rawName)) continue;

    seed.set(rawName, {
      name: rawName,
      variableType: inferVariableType(rawValue),
      sampleValue: rawValue.replace(/^["']|["']$/g, ""),
      isConstant: isLikelyConstant(rawName),
    });
  }
}

function prioritizeParameters(values: ExtractedParameter[]) {
  const ignored = new Set([
    "expected",
    "payload",
    "command",
    "catalog",
    "attributes",
    "response",
    "request",
    "topic",
    "policy",
    "message",
    "format",
  ]);

  return values
    .filter((entry) => !ignored.has(entry.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function importParametersFromPdf(input: {
  vendor: string;
  fileName: string;
  buffer: Buffer;
  persist?: boolean;
}) {
  const vendor = input.vendor.trim();
  const parser = new PDFParse({ data: input.buffer });
  let text = "";

  try {
    const pdf = await parser.getText();
    text = pdf.text ?? "";
  } finally {
    await parser.destroy();
  }

  const extractedMap = extractFromJsonLikeText(text);
  extractFromKeyValueLines(text, extractedMap);

  const extracted = prioritizeParameters(Array.from(extractedMap.values()));
  const existing = await prisma.parameter.findMany({
    where: { vendors: vendor },
    select: { id: true, name: true },
  });
  const existingNames = new Set(existing.map((row) => row.name.toLowerCase()));

  let savedCount = 0;
  const skipped: string[] = [];

  if (input.persist !== false) {
    for (const entry of extracted) {
      if (existingNames.has(entry.name.toLowerCase())) {
        skipped.push(entry.name);
        continue;
      }

      await prisma.parameter.create({
        data: {
          name: entry.name,
          vendors: vendor,
          variableType: entry.variableType,
          isConstant: entry.isConstant,
        },
      });
      savedCount += 1;
    }
  }

  return {
    vendor,
    fileName: input.fileName,
    extractedCount: extracted.length,
    savedCount,
    skippedCount: skipped.length,
    extracted,
    skipped,
    previewText: text.slice(0, 4000),
  };
}
