import {
  BucketLocationConstraint,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketEncryptionCommand,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type EnsureBucketInput = {
  client: S3Client;
  bucket: string;
  region: string;
};

const ensuredBuckets = new Map<string, Promise<void>>();

function buildCacheKey(input: EnsureBucketInput) {
  return `${input.region}:${input.bucket}`;
}

async function createBucketIfMissing(input: EnsureBucketInput) {
  try {
    await input.client.send(new HeadBucketCommand({ Bucket: input.bucket }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);
    const normalized = `${name} ${message}`.toLowerCase();
    const notFound =
      normalized.includes("notfound") ||
      normalized.includes("nosuchbucket") ||
      normalized.includes("404");

    if (!notFound) {
      throw error;
    }

    await input.client.send(
      new CreateBucketCommand({
        Bucket: input.bucket,
        ...(input.region === "us-east-1"
          ? {}
          : {
              CreateBucketConfiguration: {
                LocationConstraint: input.region as BucketLocationConstraint,
              },
            }),
      })
    );
  }

  await input.client.send(
    new PutPublicAccessBlockCommand({
      Bucket: input.bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    })
  );

  await input.client.send(
    new PutBucketEncryptionCommand({
      Bucket: input.bucket,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256",
            },
            BucketKeyEnabled: true,
          },
        ],
      },
    })
  );

  await input.client.send(
    new PutBucketVersioningCommand({
      Bucket: input.bucket,
      VersioningConfiguration: {
        Status: "Enabled",
      },
    })
  );
}

export async function ensurePrivateVersionedBucket(input: EnsureBucketInput) {
  const cacheKey = buildCacheKey(input);
  const existing = ensuredBuckets.get(cacheKey);
  if (existing) {
    await existing;
    return;
  }

  const promise = createBucketIfMissing(input).catch((error) => {
    ensuredBuckets.delete(cacheKey);
    throw error;
  });

  ensuredBuckets.set(cacheKey, promise);
  await promise;
}
