import { prisma } from '../db/prisma'

export async function saveSwitchStatus(
  deviceId: string,
  switchNo: number,
  status: string
) {
  await prisma.deviceSwitch.upsert({
    where: {
      deviceId_switchNo: {
        deviceId,
        switchNo
      }
    },
    update: {
      status
    },
    create: {
      deviceId,
      switchNo,
      status
    }
  })

  console.log(
    `🔌 Switch state saved: ${deviceId} S${switchNo} → ${status}`
  )
}
