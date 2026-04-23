import { Router } from 'express'
import { publishToDevice } from '../mqtt/publishers'
import { prisma } from '../db/prisma'

const router = Router()

/**
 * POST /api/dongle/:thingId/config
 * Configure dongle WiFi and communication settings
 */
router.post('/:thingId/config', async (req, res) => {
  const { thingId } = req.params
  const { deviceid, ssid, password, access_token, secret, mode, ota_host } = req.body

  if (!deviceid || !ssid || !password) {
    return res.status(400).json({ 
      error: 'deviceid, ssid and password are required' 
    })
  }

  const payload: any = {
    deviceid,
    ssid,
    password,
    access_token: access_token || '',
    secret: secret || '',
    mode: mode || '1', // 1=WiFi, 2=BLE, 3=custom
    ota_host: ota_host || ''
  }

  await publishToDevice(thingId, 'config', payload)

  res.json({ success: true })
})

/**
 * POST /api/dongle/:thingId/setting
 * Configure channel settings (childlock, etc.)
 */
router.post('/:thingId/setting', async (req, res) => {
  const { thingId } = req.params
  const { deviceid, channel, switch_no, childlock } = req.body

  if (!deviceid || !channel || !switch_no) {
    return res.status(400).json({ 
      error: 'deviceid, channel and switch_no are required' 
    })
  }

  const payload: any = {
    deviceid,
    channel: channel.toString(),
    switch_no: switch_no.toString(),
    childlock: childlock || ''
  }

  await publishToDevice(thingId, 'setting', payload)

  res.json({ success: true })
})

/**
 * POST /api/dongle/:thingId/reset
 * Reset device to default settings
 */
router.post('/:thingId/reset', async (req, res) => {
  const { thingId } = req.params
  const { deviceid, mode, secret } = req.body

  if (!deviceid) {
    return res.status(400).json({ error: 'deviceid is required' })
  }

  const payload: any = {
    deviceid,
    mode: mode || '1',
    secret: secret || ''
  }

  await publishToDevice(thingId, 'reset', payload)

  res.json({ success: true })
})

/**
 * POST /api/dongle/:thingId/alive
 * Request alive status from device
 */
router.post('/:thingId/alive', async (req, res) => {
  const { thingId } = req.params
  const { deviceid } = req.body

  if (!deviceid) {
    return res.status(400).json({ error: 'deviceid is required' })
  }

  await publishToDevice(thingId, 'alive', { deviceid })

  res.json({ success: true })
})

/**
 * GET /api/dongle/:deviceId/channels
 * Get channel configuration for a dongle device
 */
router.get('/:deviceId/channels', async (req, res) => {
  const { deviceId } = req.params

  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: {
      deviceId: true,
      deviceType: true,
      channels: true
    }
  })

  if (!device) {
    return res.status(404).json({ error: 'Device not found' })
  }

  if (device.deviceType !== 'DONGLE_2CH') {
    return res.status(400).json({ error: 'Not a dongle device' })
  }

  res.json({ 
    deviceId: device.deviceId,
    channels: device.channels || null
  })
})


export default router