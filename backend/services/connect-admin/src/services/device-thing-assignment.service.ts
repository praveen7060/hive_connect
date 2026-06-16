import { prisma } from '../db/prisma'

export async function buildSafeThingAssignment(deviceId: string, thingId: string | null | undefined) {
  const normalizedDeviceId = deviceId.trim()
  const normalizedThingId = typeof thingId === 'string' ? thingId.trim() : ''

  if (!normalizedDeviceId || !normalizedThingId) {
    return {}
  }

  const existing = await prisma.device.findUnique({
    where: { thingId: normalizedThingId },
    select: { deviceId: true, thingId: true }
  })

  if (existing && existing.deviceId !== normalizedDeviceId) {
    console.warn(
      `Skipping thingId assignment for ${normalizedDeviceId}: ${normalizedThingId} already belongs to ${existing.deviceId}`
    )
    return {}
  }

  return { thingId: normalizedThingId }
}

export function isThingIdUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  const meta = 'meta' in error ? (error as { meta?: unknown }).meta : null
  const target =
    meta && typeof meta === 'object' && 'target' in meta
      ? (meta as { target?: unknown }).target
      : null

  return code === 'P2002' && Array.isArray(target) && target.includes('thingId')
}
