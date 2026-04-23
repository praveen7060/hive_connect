import { prisma } from '../db/prisma'
import { promises as fs } from 'fs'
import * as path from 'path'

export type SmartMeterLiveSnapshot = {
  deviceId: string
  meter: string | null
  updatedAt: string
  status: string | null
  temperature: number | null
  fault: string | null
  frequency: number | null
  machine: boolean | null
  voltagePhases: number[]
  currentPhases: number[]
  powerPhases: number[]
  powerFactorPhases: number[]
}

const smartMeterLiveSnapshotCache = new Map<string, SmartMeterLiveSnapshot>()
const SMART_METER_LIVE_CACHE_DIR = path.join(process.cwd(), '.runtime', 'smartmeter-live')

export function getSmartMeterLiveSnapshot(deviceId: string): SmartMeterLiveSnapshot | null {
  return smartMeterLiveSnapshotCache.get(deviceId) ?? null
}

const toFiniteArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => Number(item)).filter((n) => Number.isFinite(n))
}

const toFiniteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const normalizeSnapshot = (deviceId: string, value: unknown): SmartMeterLiveSnapshot | null => {
  if (!value || typeof value !== 'object') return null
  const source = value as any
  return {
    deviceId,
    meter:
      source.meter === null || source.meter === undefined || String(source.meter).trim() === ''
        ? null
        : String(source.meter),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
    status:
      source.status === null || source.status === undefined || String(source.status).trim() === ''
        ? null
        : String(source.status),
    temperature: toFiniteOrNull(source.temperature),
    fault:
      source.fault === null || source.fault === undefined || String(source.fault).trim() === ''
        ? null
        : String(source.fault),
    frequency: toFiniteOrNull(source.frequency),
    machine:
      typeof source.machine === 'boolean'
        ? source.machine
        : typeof source.machine === 'number'
        ? source.machine === 1
        : null,
    voltagePhases: toFiniteArray(source.voltagePhases),
    currentPhases: toFiniteArray(source.currentPhases),
    powerPhases: toFiniteArray(source.powerPhases),
    powerFactorPhases: toFiniteArray(source.powerFactorPhases)
  }
}

const snapshotFilePath = (deviceId: string) =>
  path.join(SMART_METER_LIVE_CACHE_DIR, `${deviceId}.json`)

const snapshotRichness = (snapshot: SmartMeterLiveSnapshot): number =>
  snapshot.voltagePhases.length +
  snapshot.currentPhases.length +
  snapshot.powerPhases.length +
  snapshot.powerFactorPhases.length

const persistSmartMeterLiveSnapshot = async (snapshot: SmartMeterLiveSnapshot) => {
  try {
    await fs.mkdir(SMART_METER_LIVE_CACHE_DIR, { recursive: true })
    await fs.writeFile(snapshotFilePath(snapshot.deviceId), JSON.stringify(snapshot), 'utf8')
  } catch (error) {
    console.error('❌ Error persisting smart meter live snapshot:', error)
  }
}

export async function getSmartMeterLiveSnapshotStored(
  deviceId: string
): Promise<SmartMeterLiveSnapshot | null> {
  const cached = smartMeterLiveSnapshotCache.get(deviceId) ?? null
  let best = cached

  try {
    const raw = await fs.readFile(snapshotFilePath(deviceId), 'utf8')
    const parsed = normalizeSnapshot(deviceId, JSON.parse(raw))
    if (parsed) {
      if (
        !best ||
        snapshotRichness(parsed) > snapshotRichness(best) ||
        new Date(parsed.updatedAt).getTime() > new Date(best.updatedAt).getTime()
      ) {
        best = parsed
      }
    }
  } catch {
    // ignore disk read failures and fall back to in-memory snapshot
  }

  if (best) {
    smartMeterLiveSnapshotCache.set(deviceId, best)
    return best
  }

  return null
}

/**
 * Handle smart meter update messages
 * Topic: $aws/things/(thingId)/update
 *
 * Payload example:
 * {
 *   "deviceid": "IOTIQSM_A1125004",
 *   "status": "off",
 *   "temp": "30.0C",
 *   "voltage": "235.58#236.10#240.55#235.58#408.02",
 *   "current": "1.68#0.73#1.32#3.73",
 *   "power": "-32.40#-32.67#0.02#-130.72",
 *   "Powerfactor": "-1.00#-1.00#0.13#-1.00",
 *   "frequency": "50.0"
 * }
 */
export async function handleSmartMeterUpdate(payload: any) {
  const { deviceid } = payload

  console.log(`📥 Raw payload keys for ${deviceid}:`, Object.keys(payload))
  console.log(`📥 voltage=${payload.voltage} current=${payload.current} power=${payload.power}`)

  try {
    let device = await prisma.device.findUnique({
      where: { deviceId: deviceid }
    })

    if (!device) {
      console.warn(`⚠️ Smart Meter not found: ${deviceid}. Auto-creating...`)
      device = await prisma.device.create({
        data: {
          deviceId: deviceid,
          deviceType: 'SMART_METER'
        }
      })
      console.log(`✅ Smart Meter auto-created: ${deviceid}`)
    }

    const asNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return null
        const direct = Number(trimmed)
        if (Number.isFinite(direct)) return direct
        const match = trimmed.match(/-?\d+(\.\d+)?/)
        if (match) {
          const parsed = Number(match[0])
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      }
      const n = Number(value as any)
      return Number.isFinite(n) ? n : null
    }

    const asBoolean = (value: unknown): boolean | null => {
      if (value === true || value === false) return value
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') return true
        if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') return false
      }
      if (typeof value === 'number') {
        if (value === 1) return true
        if (value === 0) return false
      }
      return null
    }

    const parseSeriesNumbers = (value: unknown): number[] => {
      if (value === null || value === undefined) return []
      if (Array.isArray(value)) {
        return value.map((item) => asNumber(item)).filter((n): n is number => n !== null)
      }
      if (typeof value === 'number') return Number.isFinite(value) ? [value] : []
      if (typeof value !== 'string') return []
      return value
        .replace(/#/g, '/')
        .split(/[\/,|;]/)
        .map((part) => asNumber(part))
        .filter((n): n is number => n !== null)
    }

    const roundTo = (value: number | null, decimals: number): number | null => {
      if (value === null || !Number.isFinite(value)) return null
      const scale = 10 ** decimals
      return Math.round(value * scale) / scale
    }

    const voltageSeries     = parseSeriesNumbers(payload.voltage)
    const currentSeries     = parseSeriesNumbers(payload.current)
    const powerSeries       = parseSeriesNumbers(payload.power)
    const powerFactorSeries = parseSeriesNumbers(
      payload.Powerfactor ?? payload.powerFactor ?? payload.power_factor ?? payload.powerfactor
    )

    // ✅ Guard: skip saving if core electrical series are missing
    if (voltageSeries.length === 0 || currentSeries.length === 0 || powerSeries.length === 0) {
      console.warn(
        `⚠️ Skipping partial payload for ${deviceid} — missing electrical series. Keys: ${Object.keys(payload).join(', ')}`
      )
      return
    }

    // Parse individual phases
    const voltagePhase1 = asNumber(voltageSeries[0])
    const voltagePhase2 = asNumber(voltageSeries[1])
    const voltagePhase3 = asNumber(voltageSeries[2])
    const voltageTotal  = asNumber(
      voltageSeries.length >= 5 ? voltageSeries[4] : voltageSeries[3] ?? voltageSeries[0]
    )

    const currentPhase1 = asNumber(currentSeries[0])
    const currentPhase2 = asNumber(currentSeries[1])
    const currentPhase3 = asNumber(currentSeries[2])
    const currentTotal  = asNumber(currentSeries[currentSeries.length - 1])

    const powerPhase1      = asNumber(powerSeries[0])
    const powerPhase2      = asNumber(powerSeries[1])
    const powerPhase3      = asNumber(powerSeries[2])
    const powerTotalActive = asNumber(powerSeries[powerSeries.length - 1])

    const powerFactorPhase1 = asNumber(powerFactorSeries[0])
    const powerFactorPhase2 = asNumber(powerFactorSeries[1])
    const powerFactorPhase3 = asNumber(powerFactorSeries[2])
    const powerFactorTotal  = asNumber(powerFactorSeries[powerFactorSeries.length - 1])

    const frequencyHz  = asNumber(payload.frequency)
    const machineValue = asBoolean(payload.machine ?? payload.status)
    const temperatureC = asNumber(payload.temp)

    const rawStatus = payload.status
    const statusValue =
      rawStatus === null || rawStatus === undefined || String(rawStatus).trim() === ''
        ? null
        : String(rawStatus).trim().toLowerCase()

    // Energy: abs(power) / 1000 per phase (instantaneous kW, not accumulated kWh)
    const energyPhaseR     = powerPhase1 !== null ? roundTo(Math.abs(powerPhase1) / 1000, 3) : null
    const energyPhaseY     = powerPhase2 !== null ? roundTo(Math.abs(powerPhase2) / 1000, 3) : null
    const energyPhaseB     = powerPhase3 !== null ? roundTo(Math.abs(powerPhase3) / 1000, 3) : null
    const energyTotal3Phase = powerTotalActive !== null ? roundTo(Math.abs(powerTotalActive) / 1000, 3) : null

    // Apparent power: S = V * I per phase, then sum
    const apparentPhase1 =
      voltagePhase1 !== null && currentPhase1 !== null ? Math.abs(voltagePhase1 * currentPhase1) : null
    const apparentPhase2 =
      voltagePhase2 !== null && currentPhase2 !== null ? Math.abs(voltagePhase2 * currentPhase2) : null
    const apparentPhase3 =
      voltagePhase3 !== null && currentPhase3 !== null ? Math.abs(voltagePhase3 * currentPhase3) : null

    const apparentFromPhases = [apparentPhase1, apparentPhase2, apparentPhase3]
      .filter((v): v is number => v !== null)
      .reduce((sum, v) => sum + v, 0)

    const apparentFromTotals =
      voltageTotal !== null && currentTotal !== null
        ? Math.abs(voltageTotal * currentTotal)
        : null

    const apparentPower = roundTo(
      apparentFromPhases > 0 ? apparentFromPhases : apparentFromTotals,
      2
    )

    // Reactive power: Q = sqrt(S² - P²)
    const reactiveFrom = (apparent: number | null, active: number | null): number | null => {
      if (apparent === null || active === null) return null
      const qSquared = apparent * apparent - active * active
      if (!Number.isFinite(qSquared)) return null
      return Math.sqrt(Math.max(qSquared, 0))
    }

    const reactivePhase1 = reactiveFrom(apparentPhase1, powerPhase1)
    const reactivePhase2 = reactiveFrom(apparentPhase2, powerPhase2)
    const reactivePhase3 = reactiveFrom(apparentPhase3, powerPhase3)

    const reactiveFromPhases = [reactivePhase1, reactivePhase2, reactivePhase3]
      .filter((v): v is number => v !== null)
      .reduce((sum, v) => sum + v, 0)

    const reactivePower = roundTo(
      reactiveFromPhases > 0
        ? reactiveFromPhases
        : reactiveFrom(apparentPower, powerTotalActive),
      2
    )

    // Update live snapshot cache
    const snapshot: SmartMeterLiveSnapshot = {
      deviceId: deviceid,
      meter: null,
      updatedAt: new Date().toISOString(),
      status: statusValue,
      temperature: temperatureC,
      fault: null,
      frequency: frequencyHz,
      machine: machineValue,
      voltagePhases: voltageSeries,
      currentPhases: currentSeries,
      powerPhases: powerSeries,
      powerFactorPhases: powerFactorSeries
    }

    smartMeterLiveSnapshotCache.set(deviceid, snapshot)
    void persistSmartMeterLiveSnapshot(snapshot)

    // Save to database
    await prisma.smartMeterData.create({
      data: {
        deviceId: deviceid,
        meter: null,

        status: statusValue,
        machine: machineValue,
        fault: null,
        temperatureC,
        frequencyHz,

        voltagePhase1,
        voltagePhase2,
        voltagePhase3,
        voltageTotal,

        currentPhase1,
        currentPhase2,
        currentPhase3,
        currentTotal,

        powerPhase1,
        powerPhase2,
        powerPhase3,
        powerTotalActive,

        powerFactorPhase1,
        powerFactorPhase2,
        powerFactorPhase3,
        powerFactorTotal,

        energyPhaseR,
        energyPhaseY,
        energyPhaseB,
        energyTotal3Phase,

        apparentPower,
        reactivePower
      }
    })

    console.log(`📊 Smart Meter update saved: ${deviceid}`)

  } catch (error) {
    console.error('❌ Error handling smart meter update:', error)
  }
}

/**
 * Handle smart meter health messages
 * Topic: $aws/things/(thingId)/health_reply
 */
export async function handleSmartMeterHealth(payload: any) {
  const { deviceid, heap, rssi, internet_speed, fault } = payload

  try {
    await prisma.deviceHealth.create({
      data: {
        deviceId: deviceid,
        heap: heap ? parseInt(heap) : null,
        rssi: rssi ? parseInt(rssi) : null,
        carrier: internet_speed || null,
        fault: fault || null
      }
    })

    console.log(`🏥 Smart Meter health saved: ${deviceid}`)
  } catch (error) {
    console.error('❌ Error handling smart meter health:', error)
  }
}

/**
 * Handle smart meter alive messages
 * Topic: $aws/things/(thingId)/alive_reply
 */
export async function handleSmartMeterAlive(topic: string, payload: any) {
  const thingId = topic.split('/')[2]

  try {
    await prisma.device.upsert({
      where: { deviceId: payload.deviceid },
      update: {
        thingId,
        ipAddress: payload.ipaddress,
        macAddress: payload.macaddress,
        firmwareVersion: payload.firmware_version,
        deviceType: 'SMART_METER'
      },
      create: {
        deviceId: payload.deviceid,
        thingId,
        deviceType: 'SMART_METER',
        ipAddress: payload.ipaddress,
        macAddress: payload.macaddress,
        firmwareVersion: payload.firmware_version
      }
    })

    console.log(`🟢 Smart Meter alive: ${payload.deviceid}`)
  } catch (error) {
    console.error('❌ Error handling smart meter alive:', error)
  }
}

/**
 * Check if a device is a smart meter based on deviceId prefix
 */
export function isSmartMeter(deviceId: unknown): boolean {
  if (typeof deviceId !== 'string' || !deviceId.trim()) return false
  return deviceId.startsWith('IOTIQSM_') || deviceId.startsWith('IOTIQSM1_')
}
