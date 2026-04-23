import { Router } from 'express'
import { publishToDevice } from '../mqtt/publishers'
import * as crypto from 'crypto'

const router = Router()

router.post('/:thingId/init', async (req, res) => {
  try {
    const { deviceid, url, ota_version } = req.body

    if (!deviceid || !url || !ota_version) {
      return res.status(400).json({
        error: 'deviceid, url and ota_version are required'
      })
    }

    const transactionId = crypto.randomUUID()

    await publishToDevice(
      req.params.thingId,
      'ota/initialize',
      {
        deviceid,
        url,
        ota_version,
        transactionId
      }
    )

    res.json({
      success: true,
      transactionId
    })

  } catch (err) {
    console.error('❌ OTA init failed:', err)
    res.status(500).json({ error: 'OTA initialization failed' })
  }
})

export default router
