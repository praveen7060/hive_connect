import { Router } from 'express'
import { getDailyEnergy } from '../services/analytics.service'


const router = Router()


router.get('/energy/:deviceId', async (req, res) => {
const data = await getDailyEnergy(req.params.deviceId)
res.json(data)
})


export default router