import { Router } from 'express'
import { prisma } from '../db/prisma'

const router = Router()

/**
 * GET /api/devices
 * Get all devices
 */
router.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(devices)
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({ error: 'Failed to fetch devices' })
  }
})

/**
 * GET /api/devices/:deviceId
 * Get single device by deviceId
 */
router.get('/:deviceId', async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: req.params.deviceId }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    // Fetch related data separately based on device type
    const switches = await prisma.deviceSwitch.findMany({
      where: { deviceId: req.params.deviceId }
    })

    const latestClimate = await prisma.deviceClimate.findFirst({
      where: { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'desc' }
    })

    const latestEnergy = await prisma.deviceEnergy.findFirst({
      where: { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'desc' }
    })

    const latestHealth = await prisma.deviceHealth.findFirst({
      where: { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'desc' }
    })

    // Smart meter specific data
    let smartMeterData = null
    let smartMeterSettings = null
    
    if (device.deviceType === 'SMART_METER') {
      smartMeterData = await prisma.smartMeterData.findFirst({
        where: { deviceId: req.params.deviceId },
        orderBy: { createdAt: 'desc' }
      })
      
      smartMeterSettings = await prisma.smartMeterSettings.findUnique({
        where: { deviceId: req.params.deviceId }
      })
    }

    const deviceWithRelations = {
      ...device,
      switches,
      climate: latestClimate,
      energy: latestEnergy,
      health: latestHealth,
      ...(device.deviceType === 'SMART_METER' && {
        smartMeterData,
        smartMeterSettings
      })
    }

    res.json(deviceWithRelations)
  } catch (error) {
    console.error('Error fetching device:', error)
    res.status(500).json({ error: 'Failed to fetch device' })
  }
})

/**
 * POST /api/devices
 * Add new device
 */
router.post('/', async (req, res) => {
  try {
    const { deviceId, deviceType, thingId } = req.body

    if (!deviceId || !deviceType || !thingId) {
      return res.status(400).json({
        error: 'deviceId, deviceType, and thingId are required'
      })
    }

    // Validate device type
    const validTypes = ['SINGLE', 'SWITCH_4CH', 'DONGLE_2CH', 'SMART_METER']
    if (!validTypes.includes(deviceType)) {
      return res.status(400).json({
        error: 'Invalid deviceType. Must be SINGLE, SWITCH_4CH, DONGLE_2CH, or SMART_METER'
      })
    }

    // Check if device already exists
    const existing = await prisma.device.findUnique({
      where: { deviceId }
    })

    if (existing) {
      return res.status(409).json({ error: 'Device already exists' })
    }

    const device = await prisma.device.create({
      data: {
        deviceId,
        deviceType,
        thingId
      }
    })

    console.log(`✅ Device created: ${deviceId} (${deviceType})`)

    res.status(201).json(device)
  } catch (error) {
    console.error('Error creating device:', error)
    res.status(500).json({ error: 'Failed to create device' })
  }
})

/**
 * DELETE /api/devices/:deviceId
 * Delete device
 */
router.delete('/:deviceId', async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: req.params.deviceId }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    // Delete smart meter settings if exists
    if (device.deviceType === 'SMART_METER') {
      await prisma.smartMeterSettings.deleteMany({
        where: { deviceId: req.params.deviceId }
      })
    }

    await prisma.device.delete({
      where: { deviceId: req.params.deviceId }
    })

    console.log(`🗑️ Device deleted: ${req.params.deviceId}`)

    res.json({ success: true, message: 'Device deleted' })
  } catch (error) {
    console.error('Error deleting device:', error)
    res.status(500).json({ error: 'Failed to delete device' })
  }
})

export default router