import { prisma } from '../db/prisma'
import { syncDiscoveredDeviceToOrbit } from './orbit-sync.service'
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
      return
    }

    let device = await prisma.device.findUnique({
      where: { deviceId: deviceid }
    })

    if (!device) {
      console.warn(`Device not found: ${deviceid}. Auto-creating...`)
      device = await prisma.device.create({
        data: {
          deviceId: deviceid,
          deviceType: inferDeviceType(deviceid),
          ...(thingId ? { thingId } : {}),
          ...(typeof firmware_version === 'string' ? { firmwareVersion: firmware_version } : {})
        }
      })
      console.log(`Device auto-created: ${deviceid}`)
    } else if (thingId || typeof firmware_version === 'string') {
      device = await prisma.device.update({
        where: { deviceId: deviceid },
        data: {
          ...(thingId ? { thingId } : {}),
          ...(typeof firmware_version === 'string' ? { firmwareVersion: firmware_version } : {})
        }
      })
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
  } catch (error) {
    console.error('Error handling update:', error)
  }
}
