/*
  Warnings:

  - The primary key for the `Device` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceClimate` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceEnergy` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceHealth` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceSwitch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `deviceType` on table `Device` required. This step will fail if there are existing NULL values in that column.
  - Made the column `temperature` on table `DeviceClimate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `humidity` on table `DeviceClimate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sunlight` on table `DeviceClimate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `voltage` on table `DeviceEnergy` required. This step will fail if there are existing NULL values in that column.
  - Made the column `current` on table `DeviceEnergy` required. This step will fail if there are existing NULL values in that column.
  - Made the column `power` on table `DeviceEnergy` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unit` on table `DeviceEnergy` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Device" DROP CONSTRAINT "Device_pkey",
ADD COLUMN     "channels" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "deviceType" SET NOT NULL,
ALTER COLUMN "deviceType" SET DEFAULT 'SINGLE',
ADD CONSTRAINT "Device_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Device_id_seq";

-- AlterTable
ALTER TABLE "DeviceClimate" DROP CONSTRAINT "DeviceClimate_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "temperature" SET NOT NULL,
ALTER COLUMN "humidity" SET NOT NULL,
ALTER COLUMN "sunlight" SET NOT NULL,
ALTER COLUMN "sunlight" SET DATA TYPE DOUBLE PRECISION,
ADD CONSTRAINT "DeviceClimate_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceClimate_id_seq";

-- AlterTable
ALTER TABLE "DeviceEnergy" DROP CONSTRAINT "DeviceEnergy_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "voltage" SET NOT NULL,
ALTER COLUMN "current" SET NOT NULL,
ALTER COLUMN "power" SET NOT NULL,
ALTER COLUMN "unit" SET NOT NULL,
ADD CONSTRAINT "DeviceEnergy_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceEnergy_id_seq";

-- AlterTable
ALTER TABLE "DeviceHealth" DROP CONSTRAINT "DeviceHealth_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceHealth_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceHealth_id_seq";

-- AlterTable
ALTER TABLE "DeviceSwitch" DROP CONSTRAINT "DeviceSwitch_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceSwitch_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceSwitch_id_seq";

-- CreateIndex
CREATE INDEX "Device_deviceId_idx" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_thingId_idx" ON "Device"("thingId");

-- CreateIndex
CREATE INDEX "Device_deviceType_idx" ON "Device"("deviceType");

-- CreateIndex
CREATE INDEX "DeviceClimate_deviceId_idx" ON "DeviceClimate"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceClimate_createdAt_idx" ON "DeviceClimate"("createdAt");

-- CreateIndex
CREATE INDEX "DeviceEnergy_deviceId_idx" ON "DeviceEnergy"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceEnergy_createdAt_idx" ON "DeviceEnergy"("createdAt");

-- CreateIndex
CREATE INDEX "DeviceHealth_deviceId_idx" ON "DeviceHealth"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceHealth_createdAt_idx" ON "DeviceHealth"("createdAt");

-- CreateIndex
CREATE INDEX "DeviceSwitch_deviceId_idx" ON "DeviceSwitch"("deviceId");

-- AddForeignKey
ALTER TABLE "DeviceSwitch" ADD CONSTRAINT "DeviceSwitch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceClimate" ADD CONSTRAINT "DeviceClimate_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEnergy" ADD CONSTRAINT "DeviceEnergy_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHealth" ADD CONSTRAINT "DeviceHealth_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
