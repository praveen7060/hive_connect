import { Router } from 'express'
import { prisma } from '../db/prisma'
import { publishToDevice } from '../mqtt/publishers'
import { subscribeDynamicTopics } from '../mqtt/subscribers'
import {
  deprovisionThingAndDeleteCertificates,
  fetchProvisioningDocuments,
  provisionThingAndStoreCertificates
} from '../services/iot-provisioning.service'

const router = Router()

const FALLBACK_THING_TYPE = 'ccms-single'
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function logInternal(event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: 'connect-admin.internal',
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  )
}

function normalizeIdentifier(input: string, fallback: string) {
  const normalized = input
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_:]+|[-_:]+$/g, '')

  return normalized || fallback
}

function generateThingName(deviceId: string, deviceType: string) {
  const normalizedDeviceId = normalizeIdentifier(deviceId, 'device')
  const normalizedType = normalizeIdentifier(deviceType.toLowerCase(), 'single')
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)

  const generated = `thing-${normalizedType}-${normalizedDeviceId}-${stamp}-${random}`
  return generated.slice(0, 128)
}

function generateThingTypeName(deviceType: string) {
  const normalizedType = normalizeIdentifier(deviceType.toLowerCase(), 'single')
  const generated = `ccms-${normalizedType}`
  return generated.slice(0, 128) || FALLBACK_THING_TYPE
}

function parsePositiveInt(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

async function acquireDeviceLock<T>(
  key: string,
  operation: (tx: typeof prisma) => Promise<T>
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', key)
    return operation(tx as typeof prisma)
  })
}

function parseAttributes(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  if (!isPlainObject(value)) {
    throw new Error('attributes must be an object of string values')
  }

  const entries = Object.entries(value)
  for (const [, entryValue] of entries) {
    if (typeof entryValue !== 'string') {
      throw new Error('attributes must contain only string values')
    }
  }

  return value as Record<string, string>
}

function normalizeSwitchNo(input: unknown) {
  const value = String(input ?? '').trim()
  if (!value) {
    return ''
  }

  if (/^S\d+$/i.test(value)) {
    return value.toUpperCase()
  }

  const digits = value.replace(/[^\d]/g, '')
  return digits ? `S${digits}` : value
}

function buildProvisioningSummaryFromDevice(device: {
  thingId: string | null
  certificateId?: string | null
  certificateArn?: string | null
  certificateBucket?: string | null
  certificateRegion?: string | null
  certificateVersion?: number | null
  certificateKey?: string | null
  privateKeyKey?: string | null
  publicKeyKey?: string | null
  metadataKey?: string | null
  lastProvisionedAt?: Date | null
}) {
  if (
    !device.thingId ||
    !device.certificateId ||
    !device.certificateArn ||
    !device.certificateBucket ||
    !device.certificateRegion ||
    !device.certificateKey ||
    !device.privateKeyKey ||
    !device.publicKeyKey ||
    !device.metadataKey
  ) {
    return null
  }

  return {
    thingName: device.thingId,
    thingArn: null,
    thingTypeName: null,
    certificateId: device.certificateId,
    certificateArn: device.certificateArn,
    certificateStatus: 'ACTIVE',
    awsAccountId: device.certificateArn.split(':')[4] || null,
    region: device.certificateRegion,
    bucket: device.certificateBucket,
    assetVersion: device.certificateVersion ?? 1,
    policyAttached: null,
    s3Keys: {
      certificate: device.certificateKey,
      privateKey: device.privateKeyKey,
      publicKey: device.publicKeyKey,
      metadata: device.metadataKey
    },
    generatedAt: device.lastProvisionedAt?.toISOString() ?? null,
    verification: {
      thingExists: true,
      certificateExists: true,
      certificateAttachedToThing: true,
      s3ObjectsStored: true
    }
  }
}

router.post('/devices/onboard', async (req, res) => {
  try {
    const body = req.body || {}
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : ''
    const deviceType = typeof body.deviceType === 'string' ? body.deviceType.trim() : 'GENERIC'
    const thingNameInput = typeof body.thingName === 'string' ? body.thingName.trim() : ''
    const thingTypeNameInput = typeof body.thingTypeName === 'string' ? body.thingTypeName.trim() : ''
    const policyName = typeof body.policyName === 'string' ? body.policyName.trim() : undefined
    const s3Prefix = typeof body.s3Prefix === 'string' ? body.s3Prefix.trim() : undefined
    const channels = typeof body.channels === 'string' ? body.channels.trim() : undefined
    const assetVersion = parsePositiveInt(body.assetVersion)
    const forceProvision = Boolean(body.forceProvision)

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' })
    }

    if (!deviceType) {
      return res.status(400).json({
        error: 'deviceType must be a non-empty string'
      })
    }

    const normalizedDeviceId = normalizeIdentifier(deviceId, 'device')
    const requestedThingName = thingNameInput ? normalizeIdentifier(thingNameInput, '') : ''
    const thingName =
      requestedThingName && requestedThingName !== normalizedDeviceId
        ? requestedThingName
        : generateThingName(normalizedDeviceId, deviceType)
    const effectiveS3Prefix = s3Prefix || `ccms/devices/${normalizedDeviceId}`
    const thingTypeName = thingTypeNameInput
      ? normalizeIdentifier(thingTypeNameInput, FALLBACK_THING_TYPE)
      : generateThingTypeName(deviceType)

    let attributes: Record<string, string> | undefined
    try {
      attributes = parseAttributes(body.attributes)
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid attributes payload'
      })
    }

    const { existingDevice, device, provisioning, reused } = await acquireDeviceLock(
      `internal:onboard:${deviceId}`,
      async (tx) => {
        const orm = tx as any
        const current = await orm.device.findUnique({ where: { deviceId } })
        if (
          current?.thingId &&
          !forceProvision &&
          thingNameInput &&
          current.thingId !== thingName
        ) {
          throw new Error(JSON.stringify({
            statusCode: 409,
            error: 'Device is already provisioned with a different thingId',
            existingThingId: current.thingId
          }))
        }

        if (current?.thingId && !forceProvision) {
          const reusedDevice = await orm.device.update({
            where: { deviceId },
            data: {
              deviceType,
              ...(channels ? { channels } : {})
            }
          })

          return {
            existingDevice: current,
            device: reusedDevice,
            provisioning: buildProvisioningSummaryFromDevice(reusedDevice),
            reused: true
          }
        }

        const nextProvisioning = await provisionThingAndStoreCertificates({
          deviceId,
          thingName,
          thingTypeName,
          policyName,
          attributes,
          s3Prefix: effectiveS3Prefix,
          assetVersion
        })

        const nextDevice = await orm.device.upsert({
          where: { deviceId },
          update: {
            deviceType,
            thingId: nextProvisioning.thingName,
            certificateId: nextProvisioning.certificateId,
            certificateArn: nextProvisioning.certificateArn,
            certificateBucket: nextProvisioning.bucket,
            certificateRegion: nextProvisioning.region,
            certificateVersion: nextProvisioning.assetVersion,
            certificateKey: nextProvisioning.s3Keys.certificate,
            privateKeyKey: nextProvisioning.s3Keys.privateKey,
            publicKeyKey: nextProvisioning.s3Keys.publicKey,
            metadataKey: nextProvisioning.s3Keys.metadata,
            lastProvisionedAt: new Date(nextProvisioning.generatedAt),
            ...(channels ? { channels } : {})
          },
          create: {
            deviceId,
            deviceType,
            thingId: nextProvisioning.thingName,
            certificateId: nextProvisioning.certificateId,
            certificateArn: nextProvisioning.certificateArn,
            certificateBucket: nextProvisioning.bucket,
            certificateRegion: nextProvisioning.region,
            certificateVersion: nextProvisioning.assetVersion,
            certificateKey: nextProvisioning.s3Keys.certificate,
            privateKeyKey: nextProvisioning.s3Keys.privateKey,
            publicKeyKey: nextProvisioning.s3Keys.publicKey,
            metadataKey: nextProvisioning.s3Keys.metadata,
            lastProvisionedAt: new Date(nextProvisioning.generatedAt),
            ...(channels ? { channels } : {})
          }
        })

        return {
          existingDevice: current,
          device: nextDevice,
          provisioning: nextProvisioning,
          reused: false
        }
      }
    )

    logInternal('device_onboarded', {
      deviceId,
      thingId: device.thingId,
      reused,
      certificateId: provisioning?.certificateId ?? null
    })

    return res.status(existingDevice ? 200 : 201).json({
      success: true,
      reused,
      device,
      provisioning
    })
  } catch (error) {
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message)
        if (parsed && typeof parsed === 'object' && parsed.statusCode) {
          return res.status(Number(parsed.statusCode)).json({
            error: parsed.error || 'Request failed',
            existingThingId: parsed.existingThingId
          })
        }
      } catch {
        // noop
      }
    }
    console.error('Internal onboarding failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal onboarding failed'
    })
  }
})

router.post('/devices/register', async (req, res) => {
  try {
    const body = req.body || {}
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : ''
    const deviceType = typeof body.deviceType === 'string' ? body.deviceType.trim() : 'GENERIC'
    const thingId = typeof body.thingId === 'string' ? body.thingId.trim() : ''
    const channels = typeof body.channels === 'string' ? body.channels.trim() : undefined
    const firmwareVersion =
      typeof body.firmwareVersion === 'string' ? body.firmwareVersion.trim() : undefined
    const ipAddress = typeof body.ipAddress === 'string' ? body.ipAddress.trim() : undefined
    const macAddress = typeof body.macAddress === 'string' ? body.macAddress.trim() : undefined

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' })
    }

    if (!deviceType) {
      return res.status(400).json({ error: 'deviceType must be a non-empty string' })
    }

    const device = await acquireDeviceLock(`internal:register:${deviceId}`, async (tx) =>
      (tx as any).device.upsert({
        where: { deviceId },
        update: {
          deviceType,
          ...(thingId ? { thingId } : {}),
          ...(channels ? { channels } : {}),
          ...(firmwareVersion ? { firmwareVersion } : {}),
          ...(ipAddress ? { ipAddress } : {}),
          ...(macAddress ? { macAddress } : {})
        },
        create: {
          deviceId,
          deviceType,
          thingId: thingId || null,
          ...(channels ? { channels } : {}),
          ...(firmwareVersion ? { firmwareVersion } : {}),
          ...(ipAddress ? { ipAddress } : {}),
          ...(macAddress ? { macAddress } : {})
        }
      })
    )

    return res.status(201).json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Internal device register failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to register device'
    })
  }
})

router.get('/devices/:deviceId', async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: req.params.deviceId }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json(device)
  } catch (error) {
    console.error('Internal device lookup failed:', error)
    return res.status(500).json({ error: 'Failed to fetch device' })
  }
})

router.get('/devices/:deviceId/provisioning', async (req, res) => {
  try {
    const device = await (prisma as any).device.findUnique({
      where: { deviceId: req.params.deviceId },
      select: {
        deviceId: true,
        thingId: true,
        deviceType: true,
        certificateId: true,
        certificateArn: true,
        certificateBucket: true,
        certificateRegion: true,
        certificateVersion: true,
        certificateKey: true,
        privateKeyKey: true,
        publicKeyKey: true,
        metadataKey: true,
        lastProvisionedAt: true,
        updatedAt: true
      }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({
      success: true,
      deviceId: device.deviceId,
      thingId: device.thingId,
      deviceType: device.deviceType,
      status: device.thingId ? 'PROVISIONED' : 'PENDING',
      certificate: device.certificateId
        ? {
            certificateId: device.certificateId,
            certificateArn: device.certificateArn,
            bucket: device.certificateBucket,
            region: device.certificateRegion,
            assetVersion: device.certificateVersion,
            s3Keys: {
              certificate: device.certificateKey,
              privateKey: device.privateKeyKey,
              publicKey: device.publicKeyKey,
              metadata: device.metadataKey
            },
            lastProvisionedAt: device.lastProvisionedAt
          }
        : null,
      updatedAt: device.updatedAt
    })
  } catch (error) {
    console.error('Internal provisioning lookup failed:', error)
    return res.status(500).json({ error: 'Failed to fetch provisioning status' })
  }
})

router.post('/devices/:deviceId/documents', async (req, res) => {
  try {
    const { deviceId } = req.params
    const body = req.body || {}

    const thingNameInput = typeof body.thingName === 'string' ? body.thingName.trim() : ''
    const documentPathsRaw = isPlainObject(body.documentPaths) ? body.documentPaths : {}

    const documentPaths = {
      certificate:
        typeof documentPathsRaw.certificate === 'string' ? documentPathsRaw.certificate.trim() : undefined,
      privateKey:
        typeof documentPathsRaw.privateKey === 'string' ? documentPathsRaw.privateKey.trim() : undefined,
      publicKey:
        typeof documentPathsRaw.publicKey === 'string' ? documentPathsRaw.publicKey.trim() : undefined,
      metadata: typeof documentPathsRaw.metadata === 'string' ? documentPathsRaw.metadata.trim() : undefined
    }

    const hasAtLeastOnePath = Object.values(documentPaths).some(Boolean)
    const device = await (prisma as any).device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        thingId: true,
        certificateBucket: true,
        certificateKey: true,
        privateKeyKey: true,
        publicKeyKey: true,
        metadataKey: true
      }
    })

    const deviceRecord = device as any

    if (!documentPaths.certificate && deviceRecord?.certificateBucket && deviceRecord?.certificateKey) {
      documentPaths.certificate = `s3://${deviceRecord.certificateBucket}/${deviceRecord.certificateKey}`
    }
    if (!documentPaths.privateKey && deviceRecord?.certificateBucket && deviceRecord?.privateKeyKey) {
      documentPaths.privateKey = `s3://${deviceRecord.certificateBucket}/${deviceRecord.privateKeyKey}`
    }
    if (!documentPaths.publicKey && deviceRecord?.certificateBucket && deviceRecord?.publicKeyKey) {
      documentPaths.publicKey = `s3://${deviceRecord.certificateBucket}/${deviceRecord.publicKeyKey}`
    }
    if (!documentPaths.metadata && deviceRecord?.certificateBucket && deviceRecord?.metadataKey) {
      documentPaths.metadata = `s3://${deviceRecord.certificateBucket}/${deviceRecord.metadataKey}`
    }

    const thingName = thingNameInput || deviceRecord?.thingId || ''
    if (!thingName && !hasAtLeastOnePath) {
      return res.status(404).json({
        error: 'Device or document paths not found'
      })
    }

    const resolvedPathCount = Object.values(documentPaths).filter(Boolean).length
    if (!resolvedPathCount) {
      return res.status(409).json({
        error: 'Device has not been provisioned with certificate assets yet',
        deviceId,
        thingId: thingName || null
      })
    }

    const result = await fetchProvisioningDocuments({
      thingName: thingName || undefined,
      documentPaths
    })

    const hasAnyDocument = Object.values(result.documents).some((value) => Boolean(value))
    if (!hasAnyDocument) {
      return res.status(404).json({
        error: 'Certificate assets were not found in S3 for this device',
        deviceId,
        thingId: result.thingName,
        sources: result.sources
      })
    }

    return res.json({
      success: true,
      deviceId,
      thingName: thingName || result.thingName,
      ...result
    })
  } catch (error) {
    console.error('Internal document fetch failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch device documents'
    })
  }
})

router.post('/devices/:deviceId/deprovision', async (req, res) => {
  try {
    const { deviceId } = req.params
    const body = req.body || {}

    const thingNameInput = typeof body.thingName === 'string' ? body.thingName.trim() : ''
    const s3Prefix = typeof body.s3Prefix === 'string' ? body.s3Prefix.trim() : undefined
    const deleteS3Objects = body.deleteS3Objects !== false
    const deleteDeviceRecord = body.deleteDeviceRecord !== false

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, thingId: true }
    })

    const thingName = thingNameInput || device?.thingId || ''
    if (!thingName) {
      return res.status(404).json({
        error: 'Device or thing not found for deprovisioning'
      })
    }

    const deprovisioning = await deprovisionThingAndDeleteCertificates({
      thingName,
      s3Prefix,
      deleteS3Objects
    })

    let deviceAction: 'deleted' | 'detached' | 'not_found' | 'unchanged' = 'not_found'
    if (device) {
      if (deleteDeviceRecord) {
        await prisma.device.delete({ where: { deviceId } })
        deviceAction = 'deleted'
      } else if (device.thingId) {
        await (prisma as any).device.update({
          where: { deviceId },
          data: {
            thingId: null,
            certificateId: null,
            certificateArn: null,
            certificateBucket: null,
            certificateRegion: null,
            certificateVersion: null,
            certificateKey: null,
            privateKeyKey: null,
            publicKeyKey: null,
            metadataKey: null,
            lastProvisionedAt: null
          }
        })
        deviceAction = 'detached'
      } else {
        deviceAction = 'unchanged'
      }
    }

    return res.json({
      success: true,
      deviceId,
      thingName,
      deviceAction,
      deprovisioning
    })
  } catch (error) {
    console.error('Internal deprovision failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to deprovision device'
    })
  }
})

router.post('/devices/:deviceId/control', async (req, res) => {
  try {
    const { deviceId } = req.params
    const body = req.body || {}
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    if (!status && !isPlainObject(body.payload)) {
      return res.status(400).json({ error: 'status is required' })
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, thingId: true, deviceType: true }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    if (!device.thingId) {
      return res.status(409).json({ error: 'Device does not have a thingId yet' })
    }

    const payload: Record<string, unknown> = isPlainObject(body.payload)
      ? {
          ...body.payload,
          deviceid:
            typeof body.payload.deviceid === 'string' && body.payload.deviceid.trim()
              ? body.payload.deviceid
              : device.deviceId
        }
      : {
          deviceid: device.deviceId,
          status
        }

    if (!isPlainObject(body.payload)) {
      if (device.deviceType === 'SWITCH_4CH' && body.switchNo !== undefined) {
        payload.switch_no = normalizeSwitchNo(body.switchNo)
      }

      if (device.deviceType === 'DONGLE_2CH') {
        const switchNoInput = body.switchNo ?? body.switch_no
        if (switchNoInput !== undefined) {
          payload.switch_no = String(switchNoInput)
        }
        if (body.channel !== undefined) {
          payload.channel = String(body.channel)
        }
      }
    }

    const subTopic = typeof body.subTopic === 'string' && body.subTopic.trim()
      ? body.subTopic.trim()
      : 'control'

    await publishToDevice(device.thingId, subTopic, payload)

    return res.json({
      success: true,
      thingId: device.thingId,
      topic: `mqtt/device/${device.thingId}/${subTopic}`
    })
  } catch (error) {
    console.error('Internal control failed:', error)
    return res.status(500).json({ error: 'Failed to publish control command' })
  }
})

router.post('/devices/:deviceId/publish', async (req, res) => {
  try {
    const { deviceId } = req.params
    const body = req.body || {}
    const subTopic = typeof body.subTopic === 'string' ? body.subTopic.trim() : ''

    if (!subTopic) {
      return res.status(400).json({ error: 'subTopic is required' })
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, thingId: true }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    if (!device.thingId) {
      return res.status(409).json({ error: 'Device does not have a thingId yet' })
    }

    if (!isPlainObject(body.payload)) {
      return res.status(400).json({ error: 'payload must be an object' })
    }

    const payload: Record<string, unknown> = {
      ...body.payload,
      deviceid: body.payload.deviceid ?? device.deviceId
    }

    await publishToDevice(device.thingId, subTopic, payload)

    return res.json({
      success: true,
      thingId: device.thingId,
      topic: `mqtt/device/${device.thingId}/${subTopic}`
    })
  } catch (error) {
    console.error('Internal publish failed:', error)
    return res.status(500).json({ error: 'Failed to publish command' })
  }
})

router.post('/iot/topics/subscribe', async (req, res) => {
  try {
    const topics = Array.isArray(req.body?.topics)
      ? req.body.topics.filter((topic: unknown) => typeof topic === 'string')
      : []

    if (topics.length === 0) {
      return res.status(400).json({ error: 'topics must be a non-empty string array' })
    }

    const result = await subscribeDynamicTopics(topics)

    return res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Internal topic subscribe failed:', error)
    return res.status(500).json({ error: 'Failed to subscribe topics' })
  }
})

export default router
