import { prisma } from '../db/prisma'

export async function handleOtaValidate(_: string, payload: any) {
  console.log(`🧩 OTA Validate: ${payload.deviceid}`)
  console.log(payload)
}
