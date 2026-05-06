import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type QrAssetUploadInput = {
  deviceRecordId: string;
  enrollmentId: string;
  token: string;
  svg: string;
};

export type QrAssetUploadResult =
  | {
      stored: true;
      storage: "s3";
      bucket: string;
      key: string;
      region: string;
      url: string | null;
      contentType: "image/svg+xml";
      uploadedAt: string;
    }
  | {
      stored: false;
      storage: "inline";
      reason: "not_configured" | "upload_failed";
      error?: string;
    };

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  prefix: string;
};

function getString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getS3Config(): S3Config | null {
  const bucket =
    getString(process.env.ORBIT_QR_S3_BUCKET) ??
    getString(process.env.AWS_IOT_RG_ONE_BUCKET_NAME) ??
    getString(process.env.AWS_S3_BUCKET_NAME);
  const region =
    getString(process.env.ORBIT_QR_S3_REGION) ??
    getString(process.env.AWS_IOT_RG_ONE_REGION_NAME) ??
    getString(process.env.AWS_REGION);
  const accessKeyId =
    getString(process.env.ORBIT_QR_AWS_ACCESS_KEY_ID) ??
    getString(process.env.AWS_IOT_RG_ONE_ACCESS_KEY) ??
    getString(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey =
    getString(process.env.ORBIT_QR_AWS_SECRET_ACCESS_KEY) ??
    getString(process.env.AWS_IOT_RG_ONE_SECRET_ACCESS_KEY) ??
    getString(process.env.AWS_SECRET_ACCESS_KEY);

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: getString(process.env.ORBIT_QR_PUBLIC_BASE_URL),
    prefix: getString(process.env.ORBIT_QR_S3_PREFIX) ?? "application-console/enrollment-qrs",
  };
}

function buildObjectKey(config: S3Config, input: QrAssetUploadInput) {
  const safeToken = input.token.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${config.prefix}/${input.deviceRecordId}/${input.enrollmentId}-${safeToken}.svg`;
}

function buildAssetUrl(config: S3Config, key: string) {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export async function uploadEnrollmentQrSvgToS3(
  input: QrAssetUploadInput
): Promise<QrAssetUploadResult> {
  const config = getS3Config();
  if (!config) {
    return {
      stored: false,
      storage: "inline",
      reason: "not_configured",
    };
  }

  const key = buildObjectKey(config, input);
  const s3 = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: input.svg,
        ContentType: "image/svg+xml",
        CacheControl: "private, max-age=300",
      })
    );

    return {
      stored: true,
      storage: "s3",
      bucket: config.bucket,
      key,
      region: config.region,
      url: buildAssetUrl(config, key),
      contentType: "image/svg+xml",
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      stored: false,
      storage: "inline",
      reason: "upload_failed",
      error: error instanceof Error ? error.message : "Unknown S3 upload error",
    };
  }
}
