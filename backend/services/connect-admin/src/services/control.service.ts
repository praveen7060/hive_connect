import { mqtt } from 'aws-iot-device-sdk-v2'
import { getMqttConnection } from '../mqtt/connection_holder'

export async function sendDeviceControl(
  thingId: string,
  status: string
) {
  const topic = `mqtt/device/${thingId}/control`

  const payload = {
    deviceid: thingId,
    status
  }

  const connection = getMqttConnection()

  await connection.publish(
    topic,
    JSON.stringify(payload),
    mqtt.QoS.AtLeastOnce
  )

  console.log('🎛️ Control sent:', thingId, status)
}
