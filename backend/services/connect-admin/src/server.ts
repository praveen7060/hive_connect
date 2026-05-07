import app from './app'
import { ENV } from './config/env'
import { connectMQTT } from './mqtt/connect'
import { subscribeTopics } from './mqtt/subscribers'
import { setMqttConnection } from './mqtt/connection_holder'

async function bootstrap() {
  try {
    const mqttConnections = await connectMQTT()
    setMqttConnection(mqttConnections[0])

    mqttConnections.forEach((connection) => {
      subscribeTopics(connection)
    })
  } catch (error) {
    console.error('MQTT bootstrap failed; starting API in degraded mode:', error)
  }

  app.listen(ENV.PORT, () => {
    console.log(`Server running on ${ENV.PORT}`)
  })
}

bootstrap()