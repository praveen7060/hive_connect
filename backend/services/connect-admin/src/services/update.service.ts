import { prisma } from '../db/prisma'
import {
  buildSafeThingAssignment,
  isThingIdUniqueConstraintError
} from './device-thing-assignment.service'
import { syncDiscoveredDeviceToOrbit, syncTelemetryToOrbit } from './orbit-sync.service'
import { provisionThingAndStoreCertificates } from './iot-provisioning.service'
import { handleSmartMeterUpdate, isSmartMeter } from './smartmeter.service'
import { saveSwitchStatus } from './switch.service'

function extractThingId(topic: string | undefined) {
  if (!topic) {
    return undefined
  }

  const match = /^\$aws\/things\/([^/]+)\/update$/i.exec(topic.trim())
  return match?.[1]
}

function inferDeviceType(deviceId: string) {
  if (deviceId.startsWith('IOTIQ4SC_')) {
    return 'SWITCH_4CH'
  }

  if (deviceId.startsWith('IOTIQDC2_')) {
    return 'DONGLE_2CH'
  }

  if (deviceId.startsWith('IOTIQSM_')) {
    return 'SMART_METER'
  }

  return 'SINGLE'
}

function buildThingTypeName(deviceType: string) {
  const normalizedType = deviceType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_:]+|[-_:]+$/g, '')

  return `ccms-${normalizedType || 'single'}`.slice(0, 128)
}

async function ensureProvisionedCertificateAssets(deviceId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `update:provision:${deviceId}`)

    const current = await tx.device.findUnique({
      where: { deviceId }
    })

    if (!current?.thingId || current.certificateId) {
      return current
    }

    const assetVersion =
      typeof current.certificateVersion === 'number' && current.certificateVersion > 0
        ? current.certificateVersion + 1
        : 1

    const provisioning = await provisionThingAndStoreCertificates({
      deviceId: current.deviceId,
      thingName: current.thingId,
      thingTypeName: buildThingTypeName(current.deviceType),
      s3Prefix: `ccms/devices/${current.deviceId}`,
      assetVersion
    })

    return tx.device.update({
      where: { deviceId },
      data: {
        certificateId: provisioning.certificateId,
        certificateArn: provisioning.certificateArn,
        certificateBucket: provisioning.bucket,
        certificateRegion: provisioning.region,
        certificateVersion: provisioning.assetVersion,
        certificateKey: provisioning.s3Keys.certificate,
        privateKeyKey: provisioning.s3Keys.privateKey,
        publicKeyKey: provisioning.s3Keys.publicKey,
        metadataKey: provisioning.s3Keys.metadata,
        lastProvisionedAt: new Date(provisioning.generatedAt)
      }
    })
  })
}

export async function handleUpdate(payload: any, topic?: string) {
  const {
    deviceid,
    climate,
    energy,
    switch_no,
    status,
    channels,
    firmware_version
  } = payload

  try {
    if (typeof deviceid !== 'string' || !deviceid.trim()) {
      console.warn('Ignoring update payload without valid deviceid:', payload)
      return
    }

    const thingId = extractThingId(topic)
    const thingAssignment = await buildSafeThingAssignment(deviceid, thingId)

    if (isSmartMeter(deviceid)) {
      await handleSmartMeterUpdate(payload)
      await syncDiscoveredDeviceToOrbit({
        serialNumber: deviceid,
        name: deviceid,
        connectionType: 'MQTT',
        project: 'ELEVATE_DISCOVERED',
        status: 'active',
        thingId,
        firmwareVersion: typeof firmware_version === 'string' ? firmware_version : undefined,
        vendorName: 'ELEVATE',
        source: 'connect-admin',
        rawPayload: payload,
        telemetryTopic: topic
      })
      await syncTelemetryToOrbit({
        serialNumber: deviceid,
        topic,
        thingId,
        vendorName: 'ELEVATE',
        source: 'connect-admin',
        receivedAt: new Date().toISOString(),
        payload
      })
      return
    }

    let device = await prisma.device.findUnique({
      where: { deviceId: deviceid }
    })

    if (!device) {
      console.warn(`Device not found: ${deviceid}. Auto-creating...`)
      const createDevice = (includeThingId: boolean) =>
        prisma.device.create({
          data: {
            deviceId: deviceid,
            deviceType: inferDeviceType(deviceid),
            ...(includeThingId ? thingAssignment : {}),
            ...(typeof firmware_version === 'string' ? { firmwareVersion: firmware_version } : {})
          }
        })

      try {
        device = await createDevice(true)
      } catch (error) {
        if (!isThingIdUniqueConstraintError(error)) {
          throw error
        }
        console.warn(`Retrying update auto-create without thingId for ${deviceid}`)
        device = await createDevice(false)
      }
      console.log(`Device auto-created: ${deviceid}`)
    } else if (thingId || typeof firmware_version === 'string') {
      const updateDevice = (includeThingId: boolean) =>
        prisma.device.update({
          where: { deviceId: deviceid },
          data: {
            ...(includeThingId ? thingAssignment : {}),
            ...(typeof firmware_version === 'string' ? { firmwareVersion: firmware_version } : {})
          }
        })

      try {
        device = await updateDevice(true)
      } catch (error) {
        if (!isThingIdUniqueConstraintError(error)) {
          throw error
        }
        console.warn(`Retrying update write without thingId for ${deviceid}`)
        device = await updateDevice(false)
      }
    }

    if (device.thingId && !device.certificateId) {
      try {
        device = await ensureProvisionedCertificateAssets(device.deviceId)
        console.log(`Certificates ensured: ${deviceid}`)
      } catch (error) {
        console.warn(
          `Certificate provisioning skipped for ${deviceid}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    }

    if (channels) {
      device = await prisma.device.update({
        where: { deviceId: deviceid },
        data: { channels }
      })
      console.log(`Channels configured: ${deviceid} -> ${channels}`)
    }

    if (climate) {
      const [temperature, humidity, sunlight] = String(climate).split('/')

      await prisma.deviceClimate.create({
        data: {
          deviceId: deviceid,
          temperature: Number(temperature),
          humidity: Number(humidity),
          sunlight: Number(sunlight)
        }
      })
    }

    if (energy) {
      const [voltage, current, power, unit] = String(energy).split('/')

      await prisma.deviceEnergy.create({
        data: {
          deviceId: deviceid,
          voltage: Number(voltage),
          current: Number(current),
          power: Number(power),
          unit: Number(unit)
        }
      })
    }

    if (switch_no && status) {
      const switchNo = Number(String(switch_no).replace(/[^\d]/g, ''))
      await saveSwitchStatus(deviceid, switchNo, status)
    }

    console.log('Update saved:', deviceid)

    await syncDiscoveredDeviceToOrbit({
      serialNumber: deviceid,
      name: deviceid,
      connectionType: 'MQTT',
      project: 'ELEVATE_DISCOVERED',
      status: 'active',
      thingId: device.thingId ?? thingId,
      firmwareVersion:
        typeof firmware_version === 'string' ? firmware_version : device.firmwareVersion ?? undefined,
      channels: channels ?? device.channels ?? undefined,
      vendorName: 'ELEVATE',
      source: 'connect-admin',
      rawPayload: payload,
      telemetryTopic: topic
    })
    await syncTelemetryToOrbit({
      serialNumber: deviceid,
      topic,
      thingId: device.thingId ?? thingId,
      vendorName: 'ELEVATE',
      source: 'connect-admin',
      receivedAt: new Date().toISOString(),
      payload
    })
  } catch (error) {
    console.error('Error handling update:', error)
  }
}
