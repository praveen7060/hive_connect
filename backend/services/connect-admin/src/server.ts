import app from './app'
import { ENV } from './config/env'
import { connectMQTT } from './mqtt/connect'
import { subscribeTopics } from './mqtt/subscribers'
import { setMqttConnection } from './mqtt/connection_holder'

async function bootstrap() {
  const mqttConnections = await connectMQTT()

  // ✅ THIS LINE IS CRITICAL
  setMqttConnection(mqttConnections[0])

  mqttConnections.forEach((connection) => {
    subscribeTopics(connection)
  })

  app.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on ${ENV.PORT}`)
  })
}

bootstrap()
