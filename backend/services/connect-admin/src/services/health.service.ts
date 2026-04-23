import { prisma } from '../db/prisma'

export async function handleHealth(payload: any) {
  const {
    deviceid,
    heap,
    rssi,
    carrier,
    fault
  } = payload

  await prisma.deviceHealth.create({
    data: {
      deviceId: deviceid,
      heap: heap ? Number(heap) : null,
      rssi: rssi ? Number(rssi) : null,
      carrier,
      fault
    }
  })

  console.log('📊 Health saved:', deviceid)
}
