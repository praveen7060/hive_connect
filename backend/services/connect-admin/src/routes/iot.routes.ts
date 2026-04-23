import { Router } from 'express'
import { provisionThingAndStoreCertificates } from '../services/iot-provisioning.service'

const router = Router()

router.post('/things/provision', async (req, res) => {
  try {
    const { thingName, policyName, attributes, s3Prefix } = req.body || {}

    if (!thingName || typeof thingName !== 'string') {
      return res.status(400).json({ error: 'thingName is required' })
    }

    if (policyName !== undefined && typeof policyName !== 'string') {
      return res.status(400).json({ error: 'policyName must be a string' })
    }

    if (
      attributes !== undefined &&
      (typeof attributes !== 'object' || Array.isArray(attributes) || attributes === null)
    ) {
      return res.status(400).json({ error: 'attributes must be an object of string values' })
    }

    if (s3Prefix !== undefined && typeof s3Prefix !== 'string') {
      return res.status(400).json({ error: 's3Prefix must be a string' })
    }

    if (attributes) {
      const invalidEntry = Object.entries(attributes).find(
        ([key, value]) => typeof key !== 'string' || typeof value !== 'string'
      )

      if (invalidEntry) {
        return res.status(400).json({ error: 'attributes must contain only string values' })
      }
    }

    const result = await provisionThingAndStoreCertificates({
      thingName,
      policyName,
      attributes,
      s3Prefix
    })

    return res.status(201).json({
      success: true,
      ...result
    })
  } catch (error: any) {
    console.error('Provisioning failed:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to provision thing'
    })
  }
})

export default router
