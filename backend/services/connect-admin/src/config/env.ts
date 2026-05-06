import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  override: true
})

const IOT_ENDPOINTS = (() => {
  const list = process.env.AWS_IOT_ENDPOINTS
    ?.split(',')
    .map((endpoint) => endpoint.trim())
    .filter((endpoint) => endpoint.length > 0)

  if (list && list.length > 0) {
    return list
  }

  const legacy = [
    process.env.AWS_IOT_ENDPOINT,
    process.env.AWS_IOT_ENDPOINT_V2,
    process.env.AWS_IOT_ENDPOINT_2
  ].filter((endpoint): endpoint is string => Boolean(endpoint))

  if (legacy.length === 0) {
    throw new Error('AWS_IOT_ENDPOINT or AWS_IOT_ENDPOINTS must be set')
  }

  return legacy
})()

const AWS_PROVISIONING = {
  region: process.env.AWS_IOT_RG_ONE_REGION_NAME || process.env.AWS_REGION,
  accessKeyId: process.env.AWS_IOT_RG_ONE_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.AWS_IOT_RG_ONE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  certBucketName: process.env.AWS_IOT_RG_ONE_BUCKET_NAME,
  defaultPolicyName: process.env.AWS_IOT_POLICY_NAME
}

export const ENV = {
  PORT: process.env.PORT || 5000,
  DB: process.env.DATABASE_URL!,
  IOT_ENDPOINTS,
  IOT_ENDPOINT: IOT_ENDPOINTS[0],
  AWS_PROVISIONING,
  ORBIT_BACKEND_BASE_URL: process.env.ORBIT_BACKEND_BASE_URL || 'http://localhost:4001',
  ORBIT_SYNC_TIMEOUT_MS: Number(process.env.ORBIT_SYNC_TIMEOUT_MS || 5000)
}
