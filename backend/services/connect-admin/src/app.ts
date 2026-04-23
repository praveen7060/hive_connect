import * as express from 'express'
import cors = require('cors')
import analyticsRoutes from './routes/analytics.routes'
import reportRoutes from './routes/report.routes'
import deviceRoutes from './routes/device.routes'
import devicesRoutes from './routes/devices.routes'
import otaRoutes from './routes/ota.routes'
import dongleRoutes from './routes/dongle.routes'
import smartMeterRoutes from './routes/smartmeterroutes'
import iotRoutes from './routes/iot.routes'
import internalRoutes from './routes/internal.routes'

const app = express()

// Middleware
app.use(express.json())
app.use(cors())

// Routes
app.use('/api/analytics', analyticsRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/device', deviceRoutes)      // Device control endpoints
app.use('/api/devices', devicesRoutes)    // Device CRUD endpoints
app.use('/api/ota', otaRoutes)
app.use('/api/dongle', dongleRoutes)
app.use('/api/smartmeter', smartMeterRoutes)
app.use('/api/iot', iotRoutes)
app.use('/internal', internalRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
