import { mqtt } from 'aws-iot-device-sdk-v2'
import { getMqttConnection } from './connection_holder'

export async function publishToDevice(
  thingId: string,
  subTopic: string,
  payload: any
) {
  const connection = getMqttConnection()

  const topic = `mqtt/device/${thingId}/${subTopic}`

  await connection.publish(
    topic,
    JSON.stringify(payload),
    mqtt.QoS.AtLeastOnce
  )

  console.log('📤 MQTT Published:', topic)
}
