import { prisma } from '../db/prisma'
import {
  buildSafeThingAssignment,
  isThingIdUniqueConstraintError
} from './device-thing-assignment.service'

export async function handleAlive(topic: string, payload: any) {
  const thingId = topic.split('/')[2]
  const thingAssignment = await buildSafeThingAssignment(payload.deviceid, thingId)

  const writeDevice = (includeThingId: boolean) =>
    prisma.device.upsert({
      where: { deviceId: payload.deviceid },
      update: {
        ...(includeThingId ? thingAssignment : {}),
        ipAddress: payload.ipaddress,
        macAddress: payload.macaddress,
        firmwareVersion: payload.firmware_version
      },
      create: {
        deviceId: payload.deviceid,
        ...(includeThingId ? thingAssignment : {}),
        ipAddress: payload.ipaddress,
        macAddress: payload.macaddress,
        firmwareVersion: payload.firmware_version
      }
    })

  try {
    await writeDevice(true)
  } catch (error) {
    if (!isThingIdUniqueConstraintError(error)) {
      throw error
    }
    console.warn(`Retrying alive write without thingId for ${payload.deviceid}`)
    await writeDevice(false)
  }

  console.log(`🟢 Alive: ${payload.deviceid}`)
}
