import { prisma } from '../db/prisma'


export const getDailyEnergy = (deviceId: string) => {
return prisma.$queryRaw`
SELECT date_trunc('day', "createdAt") AS day,
SUM(unit) as units
FROM "DeviceEnergy"
WHERE "deviceId"=${deviceId}
GROUP BY day ORDER BY day
`
}