-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "deviceType" TEXT;

-- CreateTable
CREATE TABLE "DeviceSwitch" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "switchNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSwitch_deviceId_switchNo_key" ON "DeviceSwitch"("deviceId", "switchNo");
