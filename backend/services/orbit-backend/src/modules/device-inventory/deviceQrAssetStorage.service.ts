import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { ApiError } from "../../middleware/error.middleware";
import { ensurePrivateVersionedBucket } from "../../utils/s3BucketSetup";

type UploadDeviceQrInput = {
  deviceRecordId: string;
  thingId: string;
  version: number;
  svg: string;
};

export type UploadDeviceQrResult = {
  bucket: string;
  region: string;
  objectKey: string;
  checksum: string;
  contentType: "image/svg+xml";
  uploadedAt: string;
};

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
};

function getString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getRequiredConfig(): S3Config {
  const bucket =
    getString(process.env.ORBIT_DEVICE_QR_S3_BUCKET) ??
    getString(process.env.ORBIT_QR_S3_BUCKET);
  const region =
    getString(process.env.ORBIT_DEVICE_QR_S3_REGION) ??
    getString(process.env.ORBIT_QR_S3_REGION) ??
    getString(process.env.AWS_REGION);
  const accessKeyId =
    getString(process.env.ORBIT_DEVICE_QR_AWS_ACCESS_KEY_ID) ??
    getString(process.env.ORBIT_QR_AWS_ACCESS_KEY_ID) ??
    getString(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey =
    getString(process.env.ORBIT_DEVICE_QR_AWS_SECRET_ACCESS_KEY) ??
    getString(process.env.ORBIT_QR_AWS_SECRET_ACCESS_KEY) ??
    getString(process.env.AWS_SECRET_ACCESS_KEY);

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new ApiError(
      500,
      "Dedicated device QR S3 storage is not configured",
      {
        required: [
          "ORBIT_DEVICE_QR_S3_BUCKET",
          "ORBIT_DEVICE_QR_S3_REGION",
          "ORBIT_DEVICE_QR_AWS_ACCESS_KEY_ID",
          "ORBIT_DEVICE_QR_AWS_SECRET_ACCESS_KEY",
        ],
      }
    );
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    prefix:
      getString(process.env.ORBIT_DEVICE_QR_S3_PREFIX) ??
      getString(process.env.ORBIT_QR_S3_PREFIX) ??
      "device-onboarding/qrs",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetries<T>(operation: () => Promise<T>, attempts = 3, delayMs = 300) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(delayMs * attempt);
    }
  }

  throw lastError;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function buildObjectKey(config: S3Config, input: UploadDeviceQrInput, checksum: string) {
  const generatedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const safeThingId = sanitizeSegment(input.thingId);
  return [
    config.prefix.replace(/^\/+|\/+$/g, ""),
    input.deviceRecordId,
    `v${input.version}`,
    `${generatedAt}-${safeThingId}-${checksum.slice(0, 12)}.svg`,
  ].join("/");
}

function buildTagging(input: UploadDeviceQrInput, checksum: string) {
  return [
    ["asset", "device-onboarding-qr"],
    ["deviceId", input.deviceRecordId],
    ["thingId", input.thingId],
    ["version", String(input.version)],
    ["checksum", checksum.slice(0, 32)],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export async function uploadDeviceOnboardingQrSvgToS3(
  input: UploadDeviceQrInput
): Promise<UploadDeviceQrResult> {
  const config = getRequiredConfig();
  const checksum = createHash("sha256").update(input.svg).digest("hex");
  const objectKey = buildObjectKey(config, input, checksum);
  const uploadedAt = new Date().toISOString();

  const s3 = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await ensurePrivateVersionedBucket({
    client: s3,
    bucket: config.bucket,
    region: config.region,
  });

  await runWithRetries(() =>
    s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: input.svg,
        ContentType: "image/svg+xml",
        CacheControl: "private, max-age=300",
        ServerSideEncryption: "AES256",
        Metadata: {
          "device-id": input.deviceRecordId,
          "thing-id": input.thingId,
          version: String(input.version),
          checksum,
          "generated-at": uploadedAt,
        },
        Tagging: buildTagging(input, checksum),
      })
    )
  );

  return {
    bucket: config.bucket,
    region: config.region,
    objectKey,
    checksum,
    contentType: "image/svg+xml",
    uploadedAt,
  };
}
