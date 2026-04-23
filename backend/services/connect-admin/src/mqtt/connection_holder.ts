import { mqtt } from 'aws-iot-device-sdk-v2'

let connection: mqtt.MqttClientConnection | null = null

export function setMqttConnection(conn: mqtt.MqttClientConnection) {
  connection = conn
}

export function getMqttConnection(): mqtt.MqttClientConnection {
  if (!connection) {
    throw new Error('MQTT connection not initialized')
  }
  return connection
}
