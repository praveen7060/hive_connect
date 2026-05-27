import {
  AttachPolicyCommand,
  AttachThingPrincipalCommand,
  CreateThingTypeCommand,
  CreateKeysAndCertificateCommand,
  CreateThingCommand,
  DeleteCertificateCommand,
  DeleteThingCommand,
  DetachPolicyCommand,
  DetachThingPrincipalCommand,
  DescribeCertificateCommand,
  DescribeThingCommand,
  DescribeThingTypeCommand,
  IoTClient,
  ListAttachedPoliciesCommand,
  ListThingPrincipalsCommand,
  UpdateCertificateCommand
} from '@aws-sdk/client-iot'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { X509Certificate, createHash, createPrivateKey, createPublicKey } from 'crypto'
import { ENV } from '../config/env'
import { ensurePrivateVersionedBucket } from './s3-bucket-setup.service'

type ProvisionThingInput = {
  deviceId?: string
  thingName: string
  thingTypeName?: string
  policyName?: string
  attributes?: Record<string, string>
  s3Prefix?: string
  assetVersion?: number
}

type ProvisionThingOutput = {
  thingName: string
  thingArn: string
  thingTypeName: string | null
  certificateId: string
  certificateArn: string
  certificateStatus: string | null
  awsAccountId: string | null
  region: string
  bucket: string
  assetVersion: number
  policyAttached: string | null
  s3Keys: {
    certificate: string
    privateKey: string
    publicKey: string
    metadata: string
  }
  generatedAt: string
  verification: {
    thingExists: boolean
    certificateExists: boolean
    certificateAttachedToThing: boolean
    s3ObjectsStored: boolean
  }
}

type DeprovisionThingInput = {
  thingName: string
  s3Prefix?: string
  deleteS3Objects?: boolean
}

type DeprovisionThingOutput = {
  thingName: string
  region: string
  bucket: string
  detachedCertificates: number
  detachedPolicies: number
  deletedCertificates: number
  deletedS3Objects: number
  deletedThing: boolean
}

type DocumentPathMap = {
  certificate?: string
  privateKey?: string
  publicKey?: string
  metadata?: string
}

type FetchProvisioningDocumentsInput = {
  thingName?: string
  documentPaths?: DocumentPathMap
}
        
type FetchProvisioningDocumentsOutput = {
  thingName: string | null
  region: string
  documents: {
    certificate: string | null
    privateKey: string | null
    publicKey: string | null
    metadata: string | null
  }
  sources: {
    certificate: string | null
    privateKey: string | null
    publicKey: string | null
    metadata: string | null
  }
}

type ProvisioningConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  certBucketName: string
  defaultPolicyName?: string
}

function getProvisioningConfig(): ProvisioningConfig {
  const config = ENV.AWS_PROVISIONING
  const missing: string[] = []

  if (!config.region) {
    missing.push('AWS_IOT_RG_ONE_REGION_NAME (or AWS_REGION)')
  }
  if (!config.accessKeyId) {
    missing.push('AWS_IOT_RG_ONE_ACCESS_KEY (or AWS_ACCESS_KEY_ID)')
  }
  if (!config.secretAccessKey) {
    missing.push('AWS_IOT_RG_ONE_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)')
  }
  if (!config.certBucketName) {
    missing.push('AWS_IOT_RG_ONE_BUCKET_NAME')
  }

  if (missing.length > 0) {
    throw new Error(`Missing provisioning environment variables: ${missing.join(', ')}`)
  }

  return {
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    certBucketName: config.certBucketName,
    defaultPolicyName: config.defaultPolicyName
  }
}

async function ensureThing(
  client: IoTClient,
  thingName: string,
  attributes?: Record<string, string>,
  thingTypeName?: string
) {
  try {
    await client.send(new DescribeThingCommand({ thingName }))
    return
  } catch (error: any) {
    if (error?.name !== 'ResourceNotFoundException') {
      throw error
    }
  }

  try {
    await client.send(
      new CreateThingCommand({
        thingName,
        ...(thingTypeName ? { thingTypeName } : {}),
        ...(attributes && Object.keys(attributes).length > 0
          ? { attributePayload: { attributes } }
          : {})
      })
    )
  } catch (error: any) {
    if (error?.name !== 'ResourceAlreadyExistsException') {
      throw error
    }
  }
}

function normalizeThingTypeName(value?: string) {
  if (!value) {
    return null
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_:]+|[-_:]+$/g, '')

  if (!normalized) {
    return null
  }

  return normalized.slice(0, 128)
}

async function ensureThingType(client: IoTClient, thingTypeName: string | null) {
  if (!thingTypeName) {
    return
  }

  try {
    await client.send(new DescribeThingTypeCommand({ thingTypeName }))
    return
  } catch (error: any) {
    if (error?.name !== 'ResourceNotFoundException') {
      throw error
    }
  }

  try {
    await client.send(
      new CreateThingTypeCommand({
        thingTypeName,
        thingTypeProperties: {
          thingTypeDescription: 'Auto-generated by CCMS provisioning'
        }
      })
    )
  } catch (error: any) {
    if (error?.name !== 'ResourceAlreadyExistsException') {
      throw error
    }
  }
}

function normalizePrefix(prefix?: string) {
  if (!prefix) {
    return ''
  }

  return prefix.replace(/^\/+|\/+$/g, '')
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
}

function resolveCertificateBaseKey(input: ProvisionThingInput, certificateId: string) {
  const basePrefix = normalizePrefix(input.s3Prefix)
  const version = Number.isFinite(input.assetVersion) && (input.assetVersion ?? 0) > 0
    ? Math.floor(input.assetVersion ?? 1)
    : 1
  const safeDeviceId = sanitizeSegment(input.deviceId?.trim() || input.thingName)
  const safeThingName = sanitizeSegment(input.thingName)
  const timePart = new Date().toISOString().replace(/[:.]/g, '-')

  return {
    version,
    generatedAt: new Date().toISOString(),
    keyPrefix: [
      basePrefix || 'device-certificates',
      safeDeviceId,
      safeThingName,
      `v${version}`,
      `${timePart}-${certificateId}`
    ].filter(Boolean).join('/')
  }
}

function validateCertificateMaterial(certificatePem: string, privateKey: string, publicKey: string) {
  try {
    const certificate = new X509Certificate(certificatePem)
    createPrivateKey(privateKey)
    createPublicKey(publicKey)

    return {
      subject: certificate.subject,
      issuer: certificate.issuer,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      checksum: createHash('sha256').update(certificatePem).digest('hex')
    }
  } catch (error) {
    throw new Error(
      `Generated certificate material failed validation: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }
}

function buildTagging(tags: Record<string, string | number | null | undefined>) {
  return Object.entries(tags)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

function getCertificateIdFromArn(certificateArn: string) {
  const parts = certificateArn.split('/')
  const certificateId = parts[parts.length - 1]?.trim()
  return certificateId || null
}

async function listThingPrincipals(client: IoTClient, thingName: string) {
  const principals: string[] = []
  let nextToken: string | undefined

  do {
    const response = await client.send(
      new ListThingPrincipalsCommand({
        thingName,
        ...(nextToken ? { nextToken } : {})
      })
    )

    principals.push(...(response.principals ?? []))
    nextToken = response.nextToken
  } while (nextToken)

  return principals
}

async function listAttachedPolicies(client: IoTClient, certificateArn: string) {
  const policyNames: string[] = []
  let marker: string | undefined

  do {
    const response = await client.send(
      new ListAttachedPoliciesCommand({
        target: certificateArn,
        ...(marker ? { marker } : {})
      })
    )

    for (const policy of response.policies ?? []) {
      if (policy.policyName) {
        policyNames.push(policy.policyName)
      }
    }

    marker = response.nextMarker
  } while (marker)

  return policyNames
}

async function runWithRetries<T>(
  operation: () => Promise<T>,
  attempts: number = 3,
  delayMs: number = 300
): Promise<T> {
  let lastError: unknown

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (index === attempts - 1) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

function extractS3Key(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('s3://')) {
    return trimmed.replace(/^s3:\/\/[^/]+\//, '')
  }

  return trimmed.replace(/^\/+/, '')
}

function parseS3Location(value: string, fallbackBucket: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (!trimmed.startsWith('s3://')) {
    return {
      bucket: fallbackBucket,
      key: extractS3Key(trimmed)
    }
  }

  const withoutScheme = trimmed.slice('s3://'.length)
  const firstSlashIndex = withoutScheme.indexOf('/')
  if (firstSlashIndex <= 0) {
    return null
  }

  const bucket = withoutScheme.slice(0, firstSlashIndex).trim()
  const key = extractS3Key(withoutScheme.slice(firstSlashIndex + 1))
  if (!bucket || !key) {
    return null
  }

  return { bucket, key }
}

async function streamBodyToString(body: any): Promise<string> {
  if (!body) {
    return ''
  }

  if (typeof body.transformToString === 'function') {
    return body.transformToString()
  }

  if (typeof body === 'string') {
    return body
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8')
  }

  const chunks: Buffer[] = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

export async function provisionThingAndStoreCertificates(
  input: ProvisionThingInput
): Promise<ProvisionThingOutput> {
  const thingName = input.thingName?.trim()
  if (!thingName) {
    throw new Error('thingName is required')
  }
  const thingTypeName = normalizeThingTypeName(input.thingTypeName)

  const config = getProvisioningConfig()
  const credentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }

  const iot = new IoTClient({
    region: config.region,
    credentials
  })

  const s3 = new S3Client({
    region: config.region,
    credentials
  })

  await ensurePrivateVersionedBucket({
    client: s3,
    bucket: config.certBucketName,
    region: config.region
  })

  await ensureThingType(iot, thingTypeName)
  await ensureThing(iot, thingName, input.attributes, thingTypeName ?? undefined)

  const certificateResult = await iot.send(
    new CreateKeysAndCertificateCommand({
      setAsActive: true
    })
  )

  const certificateArn = certificateResult.certificateArn
  const certificateId = certificateResult.certificateId
  const certificatePem = certificateResult.certificatePem
  const privateKey = certificateResult.keyPair?.PrivateKey
  const publicKey = certificateResult.keyPair?.PublicKey

  if (!certificateArn || !certificateId || !certificatePem || !privateKey || !publicKey) {
    throw new Error('AWS IoT did not return complete certificate material')
  }

  const certificateValidation = validateCertificateMaterial(certificatePem, privateKey, publicKey)

  await iot.send(
    new AttachThingPrincipalCommand({
      thingName,
      principal: certificateArn
    })
  )

  const policyName = input.policyName?.trim() || config.defaultPolicyName
  if (policyName) {
    await iot.send(
      new AttachPolicyCommand({
        policyName,
        target: certificateArn
      })
    )
  }

  const { keyPrefix, version, generatedAt } = resolveCertificateBaseKey(input, certificateId)

  const certificateKey = `${keyPrefix}/certificate.pem.crt`
  const privateKeyKey = `${keyPrefix}/private.pem.key`
  const publicKeyKey = `${keyPrefix}/public.pem.key`
  const metadataKey = `${keyPrefix}/metadata.json`
  const objectTagging = buildTagging({
    asset: 'device-certificate',
    deviceId: input.deviceId,
    thingId: thingName,
    version,
    certificateId
  })

  await Promise.all([
    runWithRetries(() =>
      s3.send(
      new PutObjectCommand({
        Bucket: config.certBucketName,
        Key: certificateKey,
        Body: certificatePem,
        ContentType: 'application/x-pem-file',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'device-id': input.deviceId?.trim() || thingName,
          'thing-id': thingName,
          'certificate-id': certificateId,
          version: String(version),
          checksum: certificateValidation.checksum,
          'generated-at': generatedAt
        },
        Tagging: objectTagging
      })
    )),
    runWithRetries(() =>
      s3.send(
      new PutObjectCommand({
        Bucket: config.certBucketName,
        Key: privateKeyKey,
        Body: privateKey,
        ContentType: 'application/x-pem-file',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'device-id': input.deviceId?.trim() || thingName,
          'thing-id': thingName,
          'certificate-id': certificateId,
          version: String(version),
          'generated-at': generatedAt
        },
        Tagging: objectTagging
      })
    )),
    runWithRetries(() =>
      s3.send(
      new PutObjectCommand({
        Bucket: config.certBucketName,
        Key: publicKeyKey,
        Body: publicKey,
        ContentType: 'application/x-pem-file',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'device-id': input.deviceId?.trim() || thingName,
          'thing-id': thingName,
          'certificate-id': certificateId,
          version: String(version),
          'generated-at': generatedAt
        },
        Tagging: objectTagging
      })
    )),
    runWithRetries(() =>
      s3.send(
      new PutObjectCommand({
        Bucket: config.certBucketName,
        Key: metadataKey,
        Body: JSON.stringify(
          {
            thingName,
            deviceId: input.deviceId?.trim() || null,
            thingTypeName,
            certificateArn,
            certificateId,
            awsAccountId: certificateArn.split(':')[4] || null,
            policyName: policyName || null,
            assetVersion: version,
            generatedAt,
            validation: certificateValidation
          },
          null,
          2
        ),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'device-id': input.deviceId?.trim() || thingName,
          'thing-id': thingName,
          'certificate-id': certificateId,
          version: String(version),
          checksum: certificateValidation.checksum,
          'generated-at': generatedAt
        },
        Tagging: objectTagging
      })
    ))
  ])

  const [describedThing, principals, describedCertificate] = await Promise.all([
    runWithRetries(() => iot.send(new DescribeThingCommand({ thingName }))),
    runWithRetries(() => listThingPrincipals(iot, thingName)),
    runWithRetries(() => iot.send(new DescribeCertificateCommand({ certificateId })))
  ])

  await Promise.all([
    runWithRetries(() =>
      s3.send(
        new HeadObjectCommand({
          Bucket: config.certBucketName,
          Key: certificateKey
        })
      )
    ),
    runWithRetries(() =>
      s3.send(
        new HeadObjectCommand({
          Bucket: config.certBucketName,
          Key: privateKeyKey
        })
      )
    ),
    runWithRetries(() =>
      s3.send(
        new HeadObjectCommand({
          Bucket: config.certBucketName,
          Key: publicKeyKey
        })
      )
    ),
    runWithRetries(() =>
      s3.send(
        new HeadObjectCommand({
          Bucket: config.certBucketName,
          Key: metadataKey
        })
      )
    )
  ])

  const thingArn = describedThing.thingArn?.trim() || null
  const certificateExists = Boolean(describedCertificate.certificateDescription?.certificateArn)
  const certificateAttachedToThing = principals.includes(certificateArn)
  const thingExists = Boolean(thingArn)
  const certificateStatus =
    describedCertificate.certificateDescription?.status?.toString() ?? null
  const awsAccountId = certificateArn.split(':')[4] || null

  if (!thingExists || !certificateExists || !certificateAttachedToThing) {
    throw new Error(
      [
        'Provisioning verification failed.',
        `thingExists=${thingExists}`,
        `certificateExists=${certificateExists}`,
        `certificateAttachedToThing=${certificateAttachedToThing}`
      ].join(' ')
    )
  }

  return {
    thingName,
    thingArn: thingArn || `arn:aws:iot:${config.region}:${awsAccountId || ''}:thing/${thingName}`,
    thingTypeName,
    certificateId,
    certificateArn,
    certificateStatus,
    awsAccountId,
    region: config.region,
    bucket: config.certBucketName,
    assetVersion: version,
    policyAttached: policyName || null,
    s3Keys: {
      certificate: certificateKey,
      privateKey: privateKeyKey,
      publicKey: publicKeyKey,
      metadata: metadataKey
    },
    generatedAt,
    verification: {
      thingExists: true,
      certificateExists: true,
      certificateAttachedToThing: true,
      s3ObjectsStored: true
    }
  }
}

export async function deprovisionThingAndDeleteCertificates(
  input: DeprovisionThingInput
): Promise<DeprovisionThingOutput> {
  const thingName = input.thingName?.trim()
  if (!thingName) {
    throw new Error('thingName is required')
  }

  const config = getProvisioningConfig()
  const credentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }

  const iot = new IoTClient({
    region: config.region,
    credentials
  })

  const s3 = new S3Client({
    region: config.region,
    credentials
  })

  let detachedPolicies = 0
  let deletedCertificates = 0

  let principals: string[] = []
  try {
    principals = await listThingPrincipals(iot, thingName)
  } catch (error: any) {
    if (error?.name !== 'ResourceNotFoundException') {
      throw error
    }
  }

  for (const principal of principals) {
    const policyNames = await listAttachedPolicies(iot, principal)

    for (const policyName of policyNames) {
      try {
        await iot.send(
          new DetachPolicyCommand({
            policyName,
            target: principal
          })
        )
        detachedPolicies += 1
      } catch (error: any) {
        if (error?.name !== 'ResourceNotFoundException') {
          throw error
        }
      }
    }

    try {
      await iot.send(
        new DetachThingPrincipalCommand({
          thingName,
          principal
        })
      )
    } catch (error: any) {
      if (error?.name !== 'ResourceNotFoundException') {
        throw error
      }
    }

    const certificateId = getCertificateIdFromArn(principal)
    if (!certificateId) {
      continue
    }

    try {
      await iot.send(
        new UpdateCertificateCommand({
          certificateId,
          newStatus: 'INACTIVE'
        })
      )
    } catch (error: any) {
      if (error?.name !== 'ResourceNotFoundException' && error?.name !== 'CertificateStateException') {
        throw error
      }
    }

    try {
      await iot.send(
        new DeleteCertificateCommand({
          certificateId,
          forceDelete: true
        })
      )
      deletedCertificates += 1
    } catch (error: any) {
      if (error?.name !== 'ResourceNotFoundException') {
        throw error
      }
    }
  }

  let deletedThing = false
  try {
    await iot.send(
      new DeleteThingCommand({
        thingName
      })
    )
    deletedThing = true
  } catch (error: any) {
    if (error?.name !== 'ResourceNotFoundException') {
      throw error
    }
  }

  let deletedS3Objects = 0
  if (input.deleteS3Objects !== false) {
    const basePrefix = normalizePrefix(input.s3Prefix)
    const candidatePrefixes = Array.from(
      new Set(
        [
          `${thingName}/`,
          `${extractS3Key(`${basePrefix}/${thingName}/`)}`
        ]
          .map((prefix) => prefix.replace(/^\/+|\/+$/g, ''))
          .filter(Boolean)
          .map((prefix) => `${prefix}/`)
      )
    )

    const keys = new Set<string>()

    for (const prefix of candidatePrefixes) {
      let continuationToken: string | undefined

      do {
        const response = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.certBucketName,
            Prefix: prefix,
            ...(continuationToken ? { ContinuationToken: continuationToken } : {})
          })
        )

        for (const entry of response.Contents ?? []) {
          if (entry.Key) {
            keys.add(entry.Key)
          }
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)
    }

    const keyList = Array.from(keys)
    for (let index = 0; index < keyList.length; index += 1000) {
      const batch = keyList.slice(index, index + 1000)
      if (batch.length === 0) continue

      const response = await s3.send(
        new DeleteObjectsCommand({
          Bucket: config.certBucketName,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet: true
          }
        })
      )

      deletedS3Objects += response.Deleted?.length ?? batch.length
    }
  }

  return {
    thingName,
    region: config.region,
    bucket: config.certBucketName,
    detachedCertificates: principals.length,
    detachedPolicies,
    deletedCertificates,
    deletedS3Objects,
    deletedThing
  }
}

export async function fetchProvisioningDocuments(
  input: FetchProvisioningDocumentsInput
): Promise<FetchProvisioningDocumentsOutput> {
  const config = getProvisioningConfig()
  const documentFetchTimeoutMs = (() => {
    const parsed = Number(process.env.AWS_IOT_DOCUMENT_FETCH_TIMEOUT_MS ?? 10000)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10000
  })()
  const credentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }

  const s3 = new S3Client({
    region: config.region,
    credentials
  })

  const paths = input.documentPaths ?? {}
  const targets = {
    certificate: paths.certificate ? parseS3Location(paths.certificate, config.certBucketName) : null,
    privateKey: paths.privateKey ? parseS3Location(paths.privateKey, config.certBucketName) : null,
    publicKey: paths.publicKey ? parseS3Location(paths.publicKey, config.certBucketName) : null,
    metadata: paths.metadata ? parseS3Location(paths.metadata, config.certBucketName) : null
  }

  const loadDocument = async (
    target: { bucket: string; key: string } | null
  ): Promise<string | null> => {
    if (!target) {
      return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), documentFetchTimeoutMs)

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: target.bucket,
          Key: target.key
        }),
        { abortSignal: controller.signal }
      )

      return streamBodyToString(response.Body)
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        console.warn(
          `Document fetch timed out after ${documentFetchTimeoutMs}ms for s3://${target.bucket}/${target.key}`
        )
        return null
      }
      if (error?.name === 'NoSuchKey' || error?.name === 'NotFound') {
        return null
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const [certificate, privateKey, publicKey, metadata] = await Promise.all([
    loadDocument(targets.certificate),
    loadDocument(targets.privateKey),
    loadDocument(targets.publicKey),
    loadDocument(targets.metadata)
  ])

  return {
    thingName: input.thingName?.trim() || null,
    region: config.region,
    documents: {
      certificate,
      privateKey,
      publicKey,
      metadata
    },
    sources: {
      certificate: targets.certificate ? `s3://${targets.certificate.bucket}/${targets.certificate.key}` : null,
      privateKey: targets.privateKey ? `s3://${targets.privateKey.bucket}/${targets.privateKey.key}` : null,
      publicKey: targets.publicKey ? `s3://${targets.publicKey.bucket}/${targets.publicKey.key}` : null,
      metadata: targets.metadata ? `s3://${targets.metadata.bucket}/${targets.metadata.key}` : null
    }
  }
}
