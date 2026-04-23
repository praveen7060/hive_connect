/*
  Warnings:

  - You are about to drop the column `current` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `frequency` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `power` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `powerFactor` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `voltage` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `voltage1` on the `SmartMeterData` table. All the data in the column will be lost.
  - You are about to drop the column `voltage2` on the `SmartMeterData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SmartMeterData" DROP COLUMN "current",
DROP COLUMN "frequency",
DROP COLUMN "power",
DROP COLUMN "powerFactor",
DROP COLUMN "temperature",
DROP COLUMN "unit",
DROP COLUMN "voltage",
DROP COLUMN "voltage1",
DROP COLUMN "voltage2",
ADD COLUMN     "apparentPower" DOUBLE PRECISION,
ADD COLUMN     "currentPhase1" DOUBLE PRECISION,
ADD COLUMN     "currentPhase2" DOUBLE PRECISION,
ADD COLUMN     "currentPhase3" DOUBLE PRECISION,
ADD COLUMN     "currentTotal" DOUBLE PRECISION,
ADD COLUMN     "energyPhaseB" DOUBLE PRECISION,
ADD COLUMN     "energyPhaseR" DOUBLE PRECISION,
ADD COLUMN     "energyPhaseY" DOUBLE PRECISION,
ADD COLUMN     "energyTotal3Phase" DOUBLE PRECISION,
ADD COLUMN     "frequencyHz" DOUBLE PRECISION,
ADD COLUMN     "powerFactorPhase1" DOUBLE PRECISION,
ADD COLUMN     "powerFactorPhase2" DOUBLE PRECISION,
ADD COLUMN     "powerFactorPhase3" DOUBLE PRECISION,
ADD COLUMN     "powerFactorTotal" DOUBLE PRECISION,
ADD COLUMN     "powerPhase1" DOUBLE PRECISION,
ADD COLUMN     "powerPhase2" DOUBLE PRECISION,
ADD COLUMN     "powerPhase3" DOUBLE PRECISION,
ADD COLUMN     "powerTotalActive" DOUBLE PRECISION,
ADD COLUMN     "reactivePower" DOUBLE PRECISION,
ADD COLUMN     "temperatureC" DOUBLE PRECISION,
ADD COLUMN     "voltagePhase1" DOUBLE PRECISION,
ADD COLUMN     "voltagePhase2" DOUBLE PRECISION,
ADD COLUMN     "voltagePhase3" DOUBLE PRECISION,
ADD COLUMN     "voltageTotal" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "SmartMeterData_deviceId_createdAt_idx" ON "SmartMeterData"("deviceId", "createdAt");
