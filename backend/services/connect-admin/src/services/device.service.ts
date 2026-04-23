import { prisma } from '../db/prisma'

export async function handleAlive(payload: any) {
  const {
    deviceid,
    ipaddress,
    macaddress,
    firmware_version
  } = payload

  let deviceType = 'SINGLE'
  
  if (deviceid.startsWith('IOTIQ4SC_')) {
    deviceType = 'SWITCH_4CH'
  } else if (deviceid.startsWith('IOTIQDC2_')) {
    deviceType = 'DONGLE_2CH'
  }

  await prisma.device.upsert({
    where: { deviceId: deviceid },
    update: {
      ipAddress: ipaddress,
      macAddress: macaddress,
      firmwareVersion: firmware_version,
      deviceType
    },
    create: {
      deviceId: deviceid,
      deviceType,
      ipAddress: ipaddress,
      macAddress: macaddress,
      firmwareVersion: firmware_version
    }
  })

  console.log('✅ Device alive saved:', deviceid)
}