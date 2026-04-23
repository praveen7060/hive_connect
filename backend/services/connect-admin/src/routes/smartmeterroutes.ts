import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { publishToDevice } from '../mqtt/publishers'
import { prisma } from '../db/prisma'
import { getSmartMeterLiveSnapshotStored } from '../services/smartmeter.service'

const router = Router()
const SMART_METER_STALE_MS = 3 * 60 * 1000
const SMART_METER_STALE_SECONDS = SMART_METER_STALE_MS / 1000

const getQueryString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : first !== undefined ? String(first) : undefined
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

const parseDateParam = (value?: string): Date | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = (input: string | number) => {
    const date = new Date(input)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const direct = parsed(trimmed)
  if (direct) return direct

  if (/^\d+$/.test(trimmed)) {
    const date = parsed(Number(trimmed))
    if (date) return date
  }

  if (trimmed.includes(' ') && !trimmed.includes('+')) {
    const plusFixed = parsed(trimmed.replace(' ', '+'))
    if (plusFixed) return plusFixed
  }

  return null
}

const parseBucket = (value?: string): string | null => {
  if (!value) return 'hour'
  const bucket = value.toLowerCase()
  const allowed = ['minute', 'hour', 'day', 'week', 'month']
  return allowed.includes(bucket) ? bucket : null
}

const parsePositiveInt = (value?: string, defaultValue?: number, maxValue?: number): number | null => {
  if (!value) return defaultValue ?? null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  if (maxValue && parsed > maxValue) return maxValue
  return parsed
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const isSmartMeterDataStale = (createdAt?: Date | null): boolean => {
  if (!createdAt) return true
  return Date.now() - createdAt.getTime() > SMART_METER_STALE_MS
}

const connectivityStatusFromFreshness = (createdAt?: Date | null): 'on' | 'off' =>
  isSmartMeterDataStale(createdAt) ? 'off' : 'on'


const SMART_METER_PREFIX_SUFFIXES = [
  'timestamp',
  'status',
  'machine',
  'fault',
  'temperatureC',
  'frequencyHz',
  'voltage_phase1',
  'voltage_phase2',
  'voltage_phase3',
  'voltage_total',
  'current_phase1',
  'current_phase2',
  'current_phase3',
  'current_total',
  'power_phase1',
  'power_phase2',
  'power_phase3',
  'power_totalActive',
  'powerFactor_phase1',
  'powerFactor_phase2',
  'powerFactor_phase3',
  'powerFactor_total',
  'energy_phaseR_kWh',
  'energy_phaseY_kWh',
  'energy_phaseB_kWh',
  'energy_total3Phase_kWh',
  'reactivePower_var',
  'apparentPower_VA'
]

const buildNullPrefixedParameters = (parameterPrefix: string): Record<string, null> => {
  const result: Record<string, null> = {}
  for (const suffix of SMART_METER_PREFIX_SUFFIXES) {
    result[`${parameterPrefix}_${suffix}`] = null
  }
  return result
}

const SMART_METER_DATA_FIELDS = [
  'id',
  'deviceId',
  'meter',
  'status',
  'machine',
  'fault',
  'temperatureC',
  'frequencyHz',
  'voltagePhase1',
  'voltagePhase2',
  'voltagePhase3',
  'voltageTotal',
  'currentPhase1',
  'currentPhase2',
  'currentPhase3',
  'currentTotal',
  'powerPhase1',
  'powerPhase2',
  'powerPhase3',
  'powerTotalActive',
  'powerFactorPhase1',
  'powerFactorPhase2',
  'powerFactorPhase3',
  'powerFactorTotal',
  'energyPhaseR',
  'energyPhaseY',
  'energyPhaseB',
  'energyTotal3Phase',
  'reactivePower',
  'apparentPower',
  'createdAt'
]

const buildNullSmartMeterData = (): Record<string, null> => {
  const result: Record<string, null> = {}
  for (const field of SMART_METER_DATA_FIELDS) {
    result[field] = null
  }
  return result
}

const buildNullSummaryMetrics = () => ({
  averages: {
    voltagePhase1: null,
    voltagePhase2: null,
    voltagePhase3: null,
    voltageTotal: null,
    currentTotal: null,
    powerFactorTotal: null,
    powerTotalActive: null,
    frequencyHz: null
  },
  minimums: {
    voltagePhase1: null,
    voltageTotal: null,
    currentTotal: null,
    powerFactorTotal: null,
    powerTotalActive: null,
    frequencyHz: null
  },
  maximums: {
    voltagePhase1: null,
    voltageTotal: null,
    currentTotal: null,
    powerFactorTotal: null,
    powerTotalActive: null,
    frequencyHz: null
  },
  machine: {
    on: null,
    off: null,
    unknown: null,
    onRatio: null
  }
})

/**
 * POST /api/smartmeter/:thingId/config
 */
router.post('/:thingId/config', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceid, ssid, password, access_token, secret, mode } = req.body

    if (!deviceid || !ssid || !password) {
      return res.status(400).json({ error: 'deviceid, ssid and password are required' })
    }

    const payload: any = {
      deviceid,
      ssid,
      password,
      access_token: access_token || '',
      secret: secret || '',
      mode: mode || '1'
    }

    await publishToDevice(thingId, 'config', payload)
    console.log(`📡 Smart Meter config sent: ${deviceid}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Smart meter config error:', error)
    res.status(500).json({ error: 'Configuration failed' })
  }
})

/**
 * POST /api/smartmeter/:thingId/setting
 */
router.post('/:thingId/setting', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceid, status, parameter, range, thres, trig_time, stop_time, repeat } = req.body

    if (!deviceid) {
      return res.status(400).json({ error: 'deviceid is required' })
    }

    const payload: any = {
      deviceid,
      status: status || '',
      parameter: parameter || '',
      range: range || '',
      thres: thres || '',
      trig_time: trig_time || '',
      stop_time: stop_time || '',
      repeat: repeat || ''
    }

    await publishToDevice(thingId, 'setting', payload)

    if (parameter || range || thres || trig_time || stop_time || repeat) {
      await prisma.smartMeterSettings.upsert({
        where: { deviceId: deviceid },
        update: {
          parameter: parameter || undefined,
          range: range || undefined,
          threshold: thres || undefined,
          triggerTime: trig_time || undefined,
          stopTime: stop_time || undefined,
          repeatPattern: repeat || undefined
        },
        create: {
          deviceId: deviceid,
          parameter: parameter || null,
          range: range || null,
          threshold: thres || null,
          triggerTime: trig_time || null,
          stopTime: stop_time || null,
          repeatPattern: repeat || null
        }
      })
    }

    console.log(`⚙️ Smart Meter settings sent: ${deviceid}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Smart meter setting error:', error)
    res.status(500).json({ error: 'Setting configuration failed' })
  }
})

/**
 * POST /api/smartmeter/:thingId/control
 */
router.post('/:thingId/control', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceid, status } = req.body

    if (!deviceid || !status) {
      return res.status(400).json({ error: 'deviceid and status are required' })
    }

    if (!['on', 'off'].includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'status must be "on" or "off"' })
    }

    const payload = { deviceid, status: status.toLowerCase() }
    await publishToDevice(thingId, 'control', payload)
    console.log(`🎛️ Smart Meter control sent: ${deviceid} → ${status}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Smart meter control error:', error)
    res.status(500).json({ error: 'Control command failed' })
  }
})

/**
 * POST /api/smartmeter/:thingId/reset
 */
router.post('/:thingId/reset', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceid, mode, secret } = req.body

    if (!deviceid) {
      return res.status(400).json({ error: 'deviceid is required' })
    }

    const payload: any = { deviceid, mode: mode || '1', secret: secret || '' }
    await publishToDevice(thingId, 'reset', payload)
    console.log(`🔄 Smart Meter reset sent: ${deviceid}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Smart meter reset error:', error)
    res.status(500).json({ error: 'Reset command failed' })
  }
})

/**
 * POST /api/smartmeter/:thingId/alive
 */
router.post('/:thingId/alive', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceid } = req.body

    if (!deviceid) {
      return res.status(400).json({ error: 'deviceid is required' })
    }

    await publishToDevice(thingId, 'alive', { deviceid })
    console.log(`💚 Smart Meter alive request sent: ${deviceid}`)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Smart meter alive error:', error)
    res.status(500).json({ error: 'Alive request failed' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/analytics/summary
 */
router.get('/:deviceId/analytics/summary', async (req, res) => {
  try {
    const { deviceId } = req.params
    const fromValue = getQueryString(req.query.from)
    const toValue = getQueryString(req.query.to)
    const meterValue = getQueryString(req.query.meter)

    const fromDate = parseDateParam(fromValue)
    if (fromValue && !fromDate) return res.status(400).json({ error: 'Invalid from date' })

    const toDate = parseDateParam(toValue)
    if (toValue && !toDate) return res.status(400).json({ error: 'Invalid to date' })

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const where: any = { deviceId }
    if (meterValue) where.meter = meterValue
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = fromDate
      if (toDate) where.createdAt.lte = toDate
    }

    const conditions: Prisma.Sql[] = [Prisma.sql`"deviceId" = ${deviceId}`]
    if (meterValue) conditions.push(Prisma.sql`"meter" = ${meterValue}`)
    if (fromDate) conditions.push(Prisma.sql`"createdAt" >= ${fromDate}`)
    if (toDate) conditions.push(Prisma.sql`"createdAt" <= ${toDate}`)
    const whereSql = Prisma.join(conditions, ' AND ')
    const latestForStaleness = await prisma.smartMeterData.findFirst({
      where: { deviceId, ...(meterValue ? { meter: meterValue } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
    if (isSmartMeterDataStale(latestForStaleness?.createdAt)) {
      const nullMetrics = buildNullSummaryMetrics()
      return res.json({
        deviceId,
        meter: meterValue || null,
        range: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null
        },
        staleAfterSeconds: SMART_METER_STALE_SECONDS,
        dataStale: true,
        lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
        samples: null,
        averages: nullMetrics.averages,
        minimums: nullMetrics.minimums,
        maximums: nullMetrics.maximums,
        machine: nullMetrics.machine,
        first: null,
        latest: null
      })
    }

    const [summaryRows, latest, first, machineCounts] = await Promise.all([
      prisma.$queryRaw<{
        samples: number
        voltagePhase1Avg: number | null
        voltagePhase2Avg: number | null
        voltagePhase3Avg: number | null
        voltageTotalAvg: number | null
        currentTotalAvg: number | null
        powerFactorTotalAvg: number | null
        powerTotalActiveAvg: number | null
        frequencyHzAvg: number | null
        voltagePhase1Min: number | null
        voltageTotalMin: number | null
        currentTotalMin: number | null
        powerFactorTotalMin: number | null
        powerTotalActiveMin: number | null
        frequencyHzMin: number | null
        voltagePhase1Max: number | null
        voltageTotalMax: number | null
        currentTotalMax: number | null
        powerFactorTotalMax: number | null
        powerTotalActiveMax: number | null
        frequencyHzMax: number | null
      }[]>(Prisma.sql`
        SELECT
          COUNT(*)::int AS "samples",
          AVG("voltagePhase1")    AS "voltagePhase1Avg",
          AVG("voltagePhase2")    AS "voltagePhase2Avg",
          AVG("voltagePhase3")    AS "voltagePhase3Avg",
          AVG("voltageTotal")     AS "voltageTotalAvg",
          AVG("currentTotal")     AS "currentTotalAvg",
          AVG("powerFactorTotal") AS "powerFactorTotalAvg",
          AVG("powerTotalActive") AS "powerTotalActiveAvg",
          AVG("frequencyHz")      AS "frequencyHzAvg",
          MIN("voltagePhase1")    AS "voltagePhase1Min",
          MIN("voltageTotal")     AS "voltageTotalMin",
          MIN("currentTotal")     AS "currentTotalMin",
          MIN("powerFactorTotal") AS "powerFactorTotalMin",
          MIN("powerTotalActive") AS "powerTotalActiveMin",
          MIN("frequencyHz")      AS "frequencyHzMin",
          MAX("voltagePhase1")    AS "voltagePhase1Max",
          MAX("voltageTotal")     AS "voltageTotalMax",
          MAX("currentTotal")     AS "currentTotalMax",
          MAX("powerFactorTotal") AS "powerFactorTotalMax",
          MAX("powerTotalActive") AS "powerTotalActiveMax",
          MAX("frequencyHz")      AS "frequencyHzMax"
        FROM "SmartMeterData"
        WHERE ${whereSql}
      `),
      prisma.smartMeterData.findFirst({ where, orderBy: { createdAt: 'desc' } }),
      prisma.smartMeterData.findFirst({ where, orderBy: { createdAt: 'asc' } }),
      prisma.$queryRaw<{ machine: boolean | null; count: number }[]>(Prisma.sql`
        SELECT "machine", COUNT(*)::int AS "count"
        FROM "SmartMeterData"
        WHERE ${whereSql}
        GROUP BY "machine"
      `)
    ])

    const summary = summaryRows[0]
    const samples = summary ? Number(summary.samples) : 0
    const machineTotals = machineCounts.reduce((sum, row) => sum + Number(row.count), 0)
    const machineOn = machineCounts.find((row) => row.machine === true)?.count ?? 0
    const machineOff = machineCounts.find((row) => row.machine === false)?.count ?? 0
    const machineUnknown = machineCounts.find((row) => row.machine === null)?.count ?? 0
    const machineOnRatio = machineTotals > 0 ? machineOn / machineTotals : null

    res.json({
      deviceId,
      meter: meterValue || null,
      range: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null
      },
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale: false,
      lastSavedAt: latest?.createdAt?.toISOString() || null,
      samples,
      averages: {
        voltagePhase1: toNumber(summary?.voltagePhase1Avg),
        voltagePhase2: toNumber(summary?.voltagePhase2Avg),
        voltagePhase3: toNumber(summary?.voltagePhase3Avg),
        voltageTotal: toNumber(summary?.voltageTotalAvg),
        currentTotal: toNumber(summary?.currentTotalAvg),
        powerFactorTotal: toNumber(summary?.powerFactorTotalAvg),
        powerTotalActive: toNumber(summary?.powerTotalActiveAvg),
        frequencyHz: toNumber(summary?.frequencyHzAvg)
      },
      minimums: {
        voltagePhase1: toNumber(summary?.voltagePhase1Min),
        voltageTotal: toNumber(summary?.voltageTotalMin),
        currentTotal: toNumber(summary?.currentTotalMin),
        powerFactorTotal: toNumber(summary?.powerFactorTotalMin),
        powerTotalActive: toNumber(summary?.powerTotalActiveMin),
        frequencyHz: toNumber(summary?.frequencyHzMin)
      },
      maximums: {
        voltagePhase1: toNumber(summary?.voltagePhase1Max),
        voltageTotal: toNumber(summary?.voltageTotalMax),
        currentTotal: toNumber(summary?.currentTotalMax),
        powerFactorTotal: toNumber(summary?.powerFactorTotalMax),
        powerTotalActive: toNumber(summary?.powerTotalActiveMax),
        frequencyHz: toNumber(summary?.frequencyHzMax)
      },
      machine: {
        on: machineOn,
        off: machineOff,
        unknown: machineUnknown,
        onRatio: machineOnRatio
      },
      first,
      latest
    })
  } catch (error) {
    console.error('❌ Error fetching smart meter summary analytics:', error)
    res.status(500).json({ error: 'Failed to fetch summary analytics' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/analytics/series
 */
router.get('/:deviceId/analytics/series', async (req, res) => {
  try {
    const { deviceId } = req.params
    const fromValue = getQueryString(req.query.from)
    const toValue = getQueryString(req.query.to)
    const meterValue = getQueryString(req.query.meter)
    const bucketValue = getQueryString(req.query.bucket)

    const fromDate = parseDateParam(fromValue)
    if (fromValue && !fromDate) return res.status(400).json({ error: 'Invalid from date' })

    const toDate = parseDateParam(toValue)
    if (toValue && !toDate) return res.status(400).json({ error: 'Invalid to date' })

    const bucket = parseBucket(bucketValue)
    if (!bucket) return res.status(400).json({ error: 'Invalid bucket value' })

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const conditions: Prisma.Sql[] = [Prisma.sql`"deviceId" = ${deviceId}`]
    if (meterValue) conditions.push(Prisma.sql`"meter" = ${meterValue}`)
    if (fromDate) conditions.push(Prisma.sql`"createdAt" >= ${fromDate}`)
    if (toDate) conditions.push(Prisma.sql`"createdAt" <= ${toDate}`)
    const whereSql = Prisma.join(conditions, ' AND ')
    const latestForStaleness = await prisma.smartMeterData.findFirst({
      where: { deviceId, ...(meterValue ? { meter: meterValue } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
    if (isSmartMeterDataStale(latestForStaleness?.createdAt)) {
      return res.json({
        deviceId,
        meter: meterValue || null,
        bucket,
        range: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null
        },
        staleAfterSeconds: SMART_METER_STALE_SECONDS,
        dataStale: true,
        lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
        series: null
      })
    }

    const rows = await prisma.$queryRaw<{
      bucket: Date
      voltagePhase1Avg: number | null
      voltageTotalAvg: number | null
      currentTotalAvg: number | null
      powerFactorTotalAvg: number | null
      powerTotalActiveAvg: number | null
      frequencyHzAvg: number | null
      machineOnRatio: number | null
      count: number
    }[]>(Prisma.sql`
      SELECT
        date_trunc(${bucket}, "createdAt") AS "bucket",
        AVG("voltagePhase1")    AS "voltagePhase1Avg",
        AVG("voltageTotal")     AS "voltageTotalAvg",
        AVG("currentTotal")     AS "currentTotalAvg",
        AVG("powerFactorTotal") AS "powerFactorTotalAvg",
        AVG("powerTotalActive") AS "powerTotalActiveAvg",
        AVG("frequencyHz")      AS "frequencyHzAvg",
        AVG(CASE WHEN "machine" = true THEN 1 ELSE 0 END) AS "machineOnRatio",
        COUNT(*)::int AS "count"
      FROM "SmartMeterData"
      WHERE ${whereSql}
      GROUP BY 1
      ORDER BY 1
    `)

    const series = rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
      count: Number(row.count),
      averages: {
        voltagePhase1: toNumber(row.voltagePhase1Avg),
        voltageTotal: toNumber(row.voltageTotalAvg),
        currentTotal: toNumber(row.currentTotalAvg),
        powerFactorTotal: toNumber(row.powerFactorTotalAvg),
        powerTotalActive: toNumber(row.powerTotalActiveAvg),
        frequencyHz: toNumber(row.frequencyHzAvg)
      },
      machine: { onRatio: toNumber(row.machineOnRatio) }
    }))

    res.json({
      deviceId,
      meter: meterValue || null,
      bucket,
      range: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null
      },
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale: false,
      lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
      series
    })
  } catch (error) {
    console.error('❌ Error fetching smart meter series analytics:', error)
    res.status(500).json({ error: 'Failed to fetch series analytics' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/analytics/live
 */
router.get('/:deviceId/analytics/live', async (req, res) => {
  try {
    const { deviceId } = req.params
    const meterValue = getQueryString(req.query.meter)
    const prefixMatch = deviceId.match(/(\d{4})$/)
    const parameterPrefix = prefixMatch?.[1] ?? deviceId.slice(-4)

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const where: any = { deviceId }
    if (meterValue) where.meter = meterValue

    const latest = await prisma.smartMeterData.findFirst({
      where,
      orderBy: { createdAt: 'desc' }
    })
    const snapshot = await getSmartMeterLiveSnapshotStored(deviceId)

    if (!latest || isSmartMeterDataStale(latest.createdAt)) {
      return res.json({
        deviceId,
        meter: meterValue || null,
        parameterPrefix,
        staleAfterSeconds: SMART_METER_STALE_SECONDS,
        dataStale: true,
        lastSavedAt: latest?.createdAt?.toISOString() || null,
        prefixedParameters: buildNullPrefixedParameters(parameterPrefix)
      })
    }

    const pickPhase = (values: number[] | undefined, index: number): number | null => {
      if (!values || values.length <= index) return null
      const value = Number(values[index])
      return Number.isFinite(value) ? value : null
    }

    const pickLast = (values: number[] | undefined): number | null => {
      if (!values || values.length === 0) return null
      const value = Number(values[values.length - 1])
      return Number.isFinite(value) ? value : null
    }

    const voltagePhase1 = pickPhase(snapshot?.voltagePhases, 0) ?? latest.voltagePhase1 ?? null
    const voltagePhase2 = pickPhase(snapshot?.voltagePhases, 1) ?? latest.voltagePhase2 ?? null
    const voltagePhase3 = pickPhase(snapshot?.voltagePhases, 2) ?? latest.voltagePhase3 ?? null
    const voltageTotal  = pickLast(snapshot?.voltagePhases)     ?? latest.voltageTotal  ?? null

    const currentPhase1 = pickPhase(snapshot?.currentPhases, 0) ?? latest.currentPhase1 ?? null
    const currentPhase2 = pickPhase(snapshot?.currentPhases, 1) ?? latest.currentPhase2 ?? null
    const currentPhase3 = pickPhase(snapshot?.currentPhases, 2) ?? latest.currentPhase3 ?? null
    const currentTotal  = pickLast(snapshot?.currentPhases)     ?? latest.currentTotal  ?? null

    const powerPhase1      = pickPhase(snapshot?.powerPhases, 0) ?? latest.powerPhase1      ?? null
    const powerPhase2      = pickPhase(snapshot?.powerPhases, 1) ?? latest.powerPhase2      ?? null
    const powerPhase3      = pickPhase(snapshot?.powerPhases, 2) ?? latest.powerPhase3      ?? null
    const powerTotalActive = pickLast(snapshot?.powerPhases)     ?? latest.powerTotalActive ?? null

    const pfPhase1      = pickPhase(snapshot?.powerFactorPhases, 0) ?? latest.powerFactorPhase1 ?? null
    const pfPhase2      = pickPhase(snapshot?.powerFactorPhases, 1) ?? latest.powerFactorPhase2 ?? null
    const pfPhase3      = pickPhase(snapshot?.powerFactorPhases, 2) ?? latest.powerFactorPhase3 ?? null
    const pfTotal       = pickLast(snapshot?.powerFactorPhases)     ?? latest.powerFactorTotal  ?? null

    const roundTo = (value: number | null, decimals: number): number | null => {
      if (value === null || !Number.isFinite(value)) return null
      const scale = 10 ** decimals
      return Math.round(value * scale) / scale
    }

    // Apparent power
    const apparentPhase1 = voltagePhase1 !== null && currentPhase1 !== null ? Math.abs(voltagePhase1 * currentPhase1) : null
    const apparentPhase2 = voltagePhase2 !== null && currentPhase2 !== null ? Math.abs(voltagePhase2 * currentPhase2) : null
    const apparentPhase3 = voltagePhase3 !== null && currentPhase3 !== null ? Math.abs(voltagePhase3 * currentPhase3) : null

    const apparentFromPhases = [apparentPhase1, apparentPhase2, apparentPhase3]
      .filter((v): v is number => v !== null)
      .reduce((sum, v) => sum + v, 0)

    const apparentFromTotals =
      voltageTotal !== null && currentTotal !== null ? Math.abs(voltageTotal * currentTotal) : null

    const apparentPowerValue = apparentFromPhases > 0 ? apparentFromPhases : apparentFromTotals

    // Reactive power
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

    const reactivePowerValue =
      reactiveFromPhases > 0
        ? reactiveFromPhases
        : reactiveFrom(apparentPowerValue, powerTotalActive)

    const energyFromPower = (activePower: number | null): number | null =>
      activePower === null ? null : Math.abs(activePower) / 1000

    const live = {
      timestamp: latest.createdAt,
      status: connectivityStatusFromFreshness(latest.createdAt),
      machine: latest.machine,
      fault: latest.fault,
      temperatureC: latest.temperatureC,
      frequencyHz: latest.frequencyHz,
      voltage: {
        phase1: voltagePhase1,
        phase2: voltagePhase2,
        phase3: voltagePhase3,
        total: voltageTotal
      },
      current: {
        phase1: currentPhase1,
        phase2: currentPhase2,
        phase3: currentPhase3,
        total: currentTotal
      },
      power: {
        phase1: powerPhase1,
        phase2: powerPhase2,
        phase3: powerPhase3,
        totalActive: powerTotalActive
      },
      powerFactor: {
        phase1: pfPhase1,
        phase2: pfPhase2,
        phase3: pfPhase3,
        total: pfTotal
      },
      energyConsumption: {
        phaseR: roundTo(energyFromPower(powerPhase1), 3),
        phaseY: roundTo(energyFromPower(powerPhase2), 3),
        phaseB: roundTo(energyFromPower(powerPhase3), 3),
        total3Phase: roundTo(
          energyFromPower(powerTotalActive) ??
            [powerPhase1, powerPhase2, powerPhase3]
              .filter((v): v is number => v !== null)
              .reduce((sum, p) => sum + Math.abs(p) / 1000, 0),
          3
        )
      },
      additional: {
        reactivePower: roundTo(reactivePowerValue, 2),
        apparentPower: roundTo(apparentPowerValue, 2),
        frequencyHz: latest.frequencyHz,
        temperatureC: latest.temperatureC
      }
    }

    const prefixedParameters: Record<string, unknown> = {
      [`${parameterPrefix}_timestamp`]:             live.timestamp,
      [`${parameterPrefix}_stat`]:                live.status,
      [`${parameterPrefix}_machine`]:               live.machine,
      [`${parameterPrefix}_fault`]:                 live.fault,
      [`${parameterPrefix}_temperatureC`]:          live.temperatureC,
      [`${parameterPrefix}_frequencyHz`]:           live.frequencyHz,
      [`${parameterPrefix}_voltage_phase1`]:        live.voltage.phase1,
      [`${parameterPrefix}_voltage_phase2`]:        live.voltage.phase2,
      [`${parameterPrefix}_voltage_phase3`]:        live.voltage.phase3,
      [`${parameterPrefix}_voltage_total`]:         live.voltage.total,
      [`${parameterPrefix}_current_phase1`]:        live.current.phase1,
      [`${parameterPrefix}_current_phase2`]:        live.current.phase2,
      [`${parameterPrefix}_current_phase3`]:        live.current.phase3,
      [`${parameterPrefix}_current_total`]:         live.current.total,
      [`${parameterPrefix}_power_phase1`]:          live.power.phase1,
      [`${parameterPrefix}_power_phase2`]:          live.power.phase2,
      [`${parameterPrefix}_power_phase3`]:          live.power.phase3,
      [`${parameterPrefix}_power_totalActive`]:     live.power.totalActive,
      [`${parameterPrefix}_powerFactor_phase1`]:    live.powerFactor.phase1,
      [`${parameterPrefix}_powerFactor_phase2`]:    live.powerFactor.phase2,
      [`${parameterPrefix}_powerFactor_phase3`]:    live.powerFactor.phase3,
      [`${parameterPrefix}_powerFactor_total`]:     live.powerFactor.total,
      [`${parameterPrefix}_energy_phaseR_kWh`]:     live.energyConsumption.phaseR,
      [`${parameterPrefix}_energy_phaseY_kWh`]:     live.energyConsumption.phaseY,
      [`${parameterPrefix}_energy_phaseB_kWh`]:     live.energyConsumption.phaseB,
      [`${parameterPrefix}_energy_total3Phase_kWh`]: live.energyConsumption.total3Phase,
      [`${parameterPrefix}_reactivePower_var`]:     live.additional.reactivePower,
      [`${parameterPrefix}_apparentPower_VA`]:      live.additional.apparentPower
    }

    res.json({
      deviceId,
      meter: latest.meter || snapshot?.meter || meterValue || null,
      parameterPrefix,
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale: false,
      lastSavedAt: latest.createdAt.toISOString(),
      prefixedParameters
    })
  } catch (error) {
    console.error('❌ Error fetching smart meter live analytics:', error)
    res.status(500).json({ error: 'Failed to fetch live analytics' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/analytics/trend
 */
router.get('/:deviceId/analytics/trend', async (req, res) => {
  try {
    const { deviceId } = req.params
    const minutesValue = getQueryString(req.query.minutes)
    const meterValue = getQueryString(req.query.meter)
    const bucketValue = getQueryString(req.query.bucket)
    const minutes = parsePositiveInt(minutesValue, 120, 10080)

    if (minutesValue && !minutes) return res.status(400).json({ error: 'Invalid minutes value' })

    const bucket = bucketValue ? parseBucket(bucketValue) : 'minute'
    if (!bucket) return res.status(400).json({ error: 'Invalid bucket value' })

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const now = new Date()
    const fromDate = new Date(now.getTime() - (minutes ?? 120) * 60 * 1000)

    const conditions: Prisma.Sql[] = [
      Prisma.sql`"deviceId" = ${deviceId}`,
      Prisma.sql`"createdAt" >= ${fromDate}`,
      Prisma.sql`"createdAt" <= ${now}`
    ]
    if (meterValue) conditions.push(Prisma.sql`"meter" = ${meterValue}`)
    const whereSql = Prisma.join(conditions, ' AND ')
    const latestForStaleness = await prisma.smartMeterData.findFirst({
      where: { deviceId, ...(meterValue ? { meter: meterValue } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
    if (isSmartMeterDataStale(latestForStaleness?.createdAt)) {
      return res.json({
        deviceId,
        meter: meterValue || null,
        bucket,
        minutes,
        range: {
          from: fromDate.toISOString(),
          to: now.toISOString()
        },
        staleAfterSeconds: SMART_METER_STALE_SECONDS,
        dataStale: true,
        lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
        series: null
      })
    }

    const rows = await prisma.$queryRaw<{
      bucket: Date
      voltagePhase1Avg: number | null
      voltageTotalAvg: number | null
      currentTotalAvg: number | null
      powerFactorTotalAvg: number | null
      powerTotalActiveAvg: number | null
      frequencyHzAvg: number | null
      machineOnRatio: number | null
      count: number
    }[]>(Prisma.sql`
      SELECT
        date_trunc(${bucket}, "createdAt") AS "bucket",
        AVG("voltagePhase1")    AS "voltagePhase1Avg",
        AVG("voltageTotal")     AS "voltageTotalAvg",
        AVG("currentTotal")     AS "currentTotalAvg",
        AVG("powerFactorTotal") AS "powerFactorTotalAvg",
        AVG("powerTotalActive") AS "powerTotalActiveAvg",
        AVG("frequencyHz")      AS "frequencyHzAvg",
        AVG(CASE WHEN "machine" = true THEN 1 ELSE 0 END) AS "machineOnRatio",
        COUNT(*)::int AS "count"
      FROM "SmartMeterData"
      WHERE ${whereSql}
      GROUP BY 1
      ORDER BY 1
    `)

    const series = rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
      count: Number(row.count),
      averages: {
        voltagePhase1: toNumber(row.voltagePhase1Avg),
        voltageTotal: toNumber(row.voltageTotalAvg),
        currentTotal: toNumber(row.currentTotalAvg),
        powerFactorTotal: toNumber(row.powerFactorTotalAvg),
        powerTotalActive: toNumber(row.powerTotalActiveAvg),
        frequencyHz: toNumber(row.frequencyHzAvg)
      },
      machine: { onRatio: toNumber(row.machineOnRatio) }
    }))

    res.json({
      deviceId,
      meter: meterValue || null,
      bucket,
      minutes,
      range: {
        from: fromDate.toISOString(),
        to: now.toISOString()
      },
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale: false,
      lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
      series
    })
  } catch (error) {
    console.error('❌ Error fetching smart meter trend analytics:', error)
    res.status(500).json({ error: 'Failed to fetch trend analytics' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/data
 */
router.get('/:deviceId/data', async (req, res) => {
  try {
    const { deviceId } = req.params
    const { limit = '10' } = req.query

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })
    const latestForStaleness = await prisma.smartMeterData.findFirst({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
    if (isSmartMeterDataStale(latestForStaleness?.createdAt)) {
      return res.json({
        deviceId: device.deviceId,
        staleAfterSeconds: SMART_METER_STALE_SECONDS,
        dataStale: true,
        lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
        data: [buildNullSmartMeterData()]
      })
    }

    const data = await prisma.smartMeterData.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    })
    const dataWithConnectivityStatus = data.map((row) => ({
      ...row,
      status: connectivityStatusFromFreshness(row.createdAt)
    }))
    res.json({
      deviceId: device.deviceId,
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale: false,
      lastSavedAt: latestForStaleness?.createdAt?.toISOString() || null,
      data: dataWithConnectivityStatus
    })
  } catch (error) {
    console.error('❌ Error fetching smart meter data:', error)
    res.status(500).json({ error: 'Failed to fetch data' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/settings
 */
router.get('/:deviceId/settings', async (req, res) => {
  try {
    const { deviceId } = req.params

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, deviceType: true }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const settings = await prisma.smartMeterSettings.findUnique({
      where: { deviceId }
    })

    res.json({ deviceId: device.deviceId, settings: settings || null })
  } catch (error) {
    console.error('❌ Error fetching smart meter settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

/**
 * GET /api/smartmeter/:deviceId/latest
 */
router.get('/:deviceId/latest', async (req, res) => {
  try {
    const { deviceId } = req.params

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        deviceType: true,
        ipAddress: true,
        firmwareVersion: true
      }
    })

    if (!device) return res.status(404).json({ error: 'Device not found' })
    if (device.deviceType !== 'SMART_METER') return res.status(400).json({ error: 'Not a smart meter device' })

    const latestData = await prisma.smartMeterData.findFirst({
      where: { deviceId },
      orderBy: { createdAt: 'desc' }
    })
    const dataStale = isSmartMeterDataStale(latestData?.createdAt)
    const latestDataResponse =
      latestData && !dataStale
        ? {
            ...latestData,
            status: connectivityStatusFromFreshness(latestData.createdAt)
          }
        : buildNullSmartMeterData()

    const settings = await prisma.smartMeterSettings.findUnique({
      where: { deviceId }
    })

    res.json({
      device: {
        deviceId: device.deviceId,
        deviceType: device.deviceType,
        ipAddress: device.ipAddress,
        firmwareVersion: device.firmwareVersion
      },
      staleAfterSeconds: SMART_METER_STALE_SECONDS,
      dataStale,
      lastSavedAt: latestData?.createdAt?.toISOString() || null,
      latestData: latestDataResponse,
      settings: settings || null
    })
  } catch (error) {
    console.error('❌ Error fetching latest smart meter data:', error)
    res.status(500).json({ error: 'Failed to fetch data' })
  }
})

export default router
