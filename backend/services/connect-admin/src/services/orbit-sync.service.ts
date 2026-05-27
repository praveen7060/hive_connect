import { ENV } from '../config/env'

type OrbitDiscoveredDevicePayload = {
  serialNumber: string
  name?: string
  connectionType?: string
  project?: string
  status?: string
  thingId?: string
  firmwareVersion?: string
  channels?: string
  vendorName?: string
  source?: string
  rawPayload?: Record<string, unknown>
  telemetryTopic?: string
}

export async function syncDiscoveredDeviceToOrbit(payload: OrbitDiscoveredDevicePayload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ENV.ORBIT_SYNC_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ENV.ORBIT_BACKEND_BASE_URL.replace(/\/+$/, '')}/api/devices/internal/discovered`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      console.warn(
        `⚠️ Orbit sync failed for ${payload.serialNumber}: ${response.status} ${details}`.trim()
      )
      return
    }

    console.log(`🔄 Orbit synced: ${payload.serialNumber}`)
  } catch (error) {
    console.warn(
      `⚠️ Orbit sync unavailable for ${payload.serialNumber}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

type OrbitTelemetryPayload = {
  serialNumber: string
  topic?: string
  thingId?: string
  vendorName?: string
  source?: string
  receivedAt?: string
  payload: Record<string, unknown>
}

export async function syncTelemetryToOrbit(payload: OrbitTelemetryPayload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ENV.ORBIT_SYNC_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${ENV.ORBIT_BACKEND_BASE_URL.replace(/\/+$/, '')}/api/iot/telemetry/ingest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      console.warn(
        `⚠️ Orbit telemetry sync failed for ${payload.serialNumber}: ${response.status} ${details}`.trim()
      )
      return
    }

    console.log(`📡 Orbit telemetry synced: ${payload.serialNumber}`)
  } catch (error) {
    console.warn(
      `⚠️ Orbit telemetry sync unavailable for ${payload.serialNumber}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
