import { Router } from 'express'
import { publishToDevice } from '../mqtt/publishers'
import { prisma } from '../db/prisma'

const router = Router()

/**
 * POST /api/device/:thingId/control
 *
 * Universal control endpoint for ALL device types
 * 
 * Body examples:
 * 
 * SINGLE:
 * {
 *   "deviceId": "ABC123",
 *   "status": "on"
 * }
 *
 * SWITCH_4CH:
 * {
 *   "deviceId": "IOTIQ4SC_A1024001",
 *   "switchNo": 1,
 *   "status": "on"
 * }
 *
 * DONGLE_2CH:
 * {
 *   "deviceId": "IOTIQDC2_A1025022",
 *   "channel": 1,
 *   "switchNo": "S1",
 *   "status": "on"
 * }
 */
router.post('/:thingId/control', async (req, res) => {
  try {
    const { thingId } = req.params
    const { deviceId, status, switchNo, channel } = req.body

    if (!deviceId || !status) {
      return res
        .status(400)
        .json({ error: 'deviceId and status are required' })
    }

    // Find device to determine type
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        deviceType: true,
        thingId: true
      }
    })

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    // Build MQTT payload based on device type
    const payload: any = {
      deviceid: deviceId,
      status
    }

    if (device.deviceType === 'SWITCH_4CH') {
      if (!switchNo) {
        return res
          .status(400)
          .json({ error: 'switchNo required for 4CH device' })
      }
      payload.switch_no = `S${switchNo}`
    }

    if (device.deviceType === 'DONGLE_2CH') {
      if (!channel || !switchNo) {
        return res
          .status(400)
          .json({ error: 'channel and switchNo required for dongle device' })
      }
      payload.channel = channel.toString()
      payload.switch_no = switchNo // Already formatted like "S1", "F1", etc.
    }

    // Publish MQTT command
    await publishToDevice(thingId, 'control', payload)

    console.log(`🎛️  Control sent: ${deviceId} (${device.deviceType}) -> ${status}`)

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Control error:', error)
    res.status(500).json({ error: 'Control command failed' })
  }
})

export default router