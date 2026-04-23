import { mqtt, iot } from 'aws-iot-device-sdk-v2'
import * as path from 'path'
import { ENV } from '../config/env'

export async function connectMQTT() {
  const defaultCerts = {
    certPath: path.resolve('certs/device.pem.crt'),
    keyPath: path.resolve('certs/private.pem.key'),
    caPath: path.resolve('certs/AmazonRootCA1.pem')
  }

  const westCerts = {
    certPath: path.resolve('certs/west-certs/client.h'),
    keyPath: path.resolve('certs/west-certs/private.h'),
    caPath: path.resolve('certs/west-certs/CA.h')
  } 

  const getCertsForEndpoint = (endpoint: string) => {
    if (endpoint.includes('eu-west-1')) {
      return westCerts
    }
    return defaultCerts
  }
       
  const client = new mqtt.MqttClient()
  const connections: mqtt.MqttClientConnection[] = []

  for (let index = 0; index < ENV.IOT_ENDPOINTS.length; index += 1) {
    const endpoint = ENV.IOT_ENDPOINTS[index]
    const { certPath, keyPath, caPath } = getCertsForEndpoint(endpoint)

    const config = iot.AwsIotMqttConnectionConfigBuilder
      .new_mtls_builder_from_path(certPath, keyPath)
      .with_certificate_authority_from_path(undefined, caPath)
      .with_client_id(`ccms-backend-${index + 1}`)
      .with_endpoint(endpoint)
      .build()

    const connection = client.new_connection(config)
    try {
      await connection.connect() 
      console.log(`✅ MQTT Connected: ${endpoint}`)
      connections.push(connection)
    } catch (error) {
      console.error(`❌ MQTT connect failed: ${endpoint}`, error)
    }
  }

  if (connections.length === 0) {
    throw new Error('No MQTT endpoints connected')
  }

  return connections
}
 