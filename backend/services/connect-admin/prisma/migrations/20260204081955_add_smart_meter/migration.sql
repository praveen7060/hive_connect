-- CreateTable
CREATE TABLE "SmartMeterData" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT,
    "temperature" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "power" DOUBLE PRECISION,
    "unit" DOUBLE PRECISION,
    "fault" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartMeterData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartMeterSettings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "parameter" TEXT,
    "range" TEXT,
    "threshold" TEXT,
    "triggerTime" TEXT,
    "stopTime" TEXT,
    "repeatPattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartMeterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartMeterData_deviceId_idx" ON "SmartMeterData"("deviceId");

-- CreateIndex
CREATE INDEX "SmartMeterData_createdAt_idx" ON "SmartMeterData"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmartMeterSettings_deviceId_key" ON "SmartMeterSettings"("deviceId");

-- CreateIndex
CREATE INDEX "SmartMeterSettings_deviceId_idx" ON "SmartMeterSettings"("deviceId");

-- AddForeignKey
ALTER TABLE "SmartMeterData" ADD CONSTRAINT "SmartMeterData_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
