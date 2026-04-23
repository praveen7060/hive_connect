import { prisma } from '../db/prisma'

export async function handleAlive(topic: string, payload: any) {
  const thingId = topic.split('/')[2]

  await prisma.device.upsert({
    where: { deviceId: payload.deviceid },
    update: {
      thingId,
      ipAddress: payload.ipaddress,
      macAddress: payload.macaddress,
      firmwareVersion: payload.firmware_version
    },
    create: {
      deviceId: payload.deviceid,
      thingId,
      ipAddress: payload.ipaddress,
      macAddress: payload.macaddress,
      firmwareVersion: payload.firmware_version
    }
  })

  console.log(`🟢 Alive: ${payload.deviceid}`)
}
