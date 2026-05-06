import { mqtt } from 'aws-iot-device-sdk-v2'
import { getMqttConnection } from './connection_holder'
import { handleAlive } from '../services/device.service'
import { handleHealth } from '../services/health.service'
import { handleUpdate } from '../services/update.service'

const subscribedTopics = new Set<string>()

const handler = (topic: string, payload: ArrayBuffer) => {
  try {
    const message = Buffer.from(payload).toString('utf-8')
    const data = JSON.parse(message)

    console.log(`MQTT [${topic}]`, data)

    routeMessage(topic, data)
  } catch (err) {
    console.error('MQTT parse error:', err)
  }
}
  
async function subscribeSingleTopic(
  connection: mqtt.MqttClientConnection,
  topic: string
) {
  if (subscribedTopics.has(topic)) {
    return { topic, subscribed: false as const, reason: 'already_subscribed' as const }
  }

  await connection.subscribe(topic, mqtt.QoS.AtLeastOnce, handler)
  subscribedTopics.add(topic)
  return { topic, subscribed: true as const }
}

export function subscribeTopics(connection: mqtt.MqttClientConnection) {
  const bootstrapTopics = [
    '$aws/things/+/alive_reply',
    '$aws/things/+/health_reply',
    '$aws/things/+/update'
  ]

  Promise.all(bootstrapTopics.map((topic) => subscribeSingleTopic(connection, topic)))
    .then(() => {
      console.log('All baseline CCMS topics subscribed')
    })
    .catch((error) => {
      console.error('Failed to subscribe baseline topics:', error)
    })
}

function routeMessage(topic: string, data: any) {
  if (topic.includes('alive_reply')) {
    handleAlive(data)
    return
  }

  if (topic.includes('health_reply')) {
    handleHealth(data)
    return
  }

  if (topic.includes('/update')) {
    handleUpdate(data, topic)
    return
  }

  console.warn('Unhandled topic:', topic)
}

export async function subscribeDynamicTopics(topics: string[]) {
  const connection = getMqttConnection()
  const sanitized = Array.from(
    new Set(
      topics
        .map((topic) => topic.trim())
        .filter((topic) => topic.length > 0)
    )
  )

  const results = await Promise.all(
    sanitized.map(async (topic) => {
      try {
        return await subscribeSingleTopic(connection, topic)
      } catch (error) {
        return {
          topic,
          subscribed: false as const,
          reason: 'failed' as const,
          error: error instanceof Error ? error.message : 'Subscription failed'
        }
      }
    })
  )

  return {
    requested: sanitized.length,
    results
  }
}
