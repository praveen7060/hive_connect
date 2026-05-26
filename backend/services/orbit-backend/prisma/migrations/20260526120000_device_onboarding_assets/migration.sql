ALTER TABLE "Device"
  ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastProvisionedAt" TIMESTAMP(3),
  ADD COLUMN "lastQrGeneratedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");
CREATE UNIQUE INDEX "Device_foreignId_key" ON "Device"("foreignId");

CREATE TABLE "DeviceCertificateAsset" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "thingId" TEXT NOT NULL,
  "certificateId" TEXT NOT NULL,
  "certificateArn" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "certificateKey" TEXT NOT NULL,
  "privateKeyKey" TEXT NOT NULL,
  "publicKeyKey" TEXT NOT NULL,
  "metadataKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "checksum" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceCertificateAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceOnboardingQrAsset" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "certificateAssetId" TEXT,
  "version" INTEGER NOT NULL,
  "bucket" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'image/svg+xml',
  "checksum" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceOnboardingQrAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceProvisioningAudit" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT,
  "workflowId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "deviceSerialNumber" TEXT NOT NULL,
  "thingId" TEXT,
  "message" TEXT,
  "requestPayload" TEXT,
  "responsePayload" TEXT,
  "errorPayload" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceProvisioningAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceCertificateAsset_deviceId_version_key" ON "DeviceCertificateAsset"("deviceId", "version");
CREATE UNIQUE INDEX "DeviceCertificateAsset_certificateId_key" ON "DeviceCertificateAsset"("certificateId");
CREATE INDEX "DeviceCertificateAsset_deviceId_status_idx" ON "DeviceCertificateAsset"("deviceId", "status");

CREATE UNIQUE INDEX "DeviceOnboardingQrAsset_deviceId_version_key" ON "DeviceOnboardingQrAsset"("deviceId", "version");
CREATE INDEX "DeviceOnboardingQrAsset_deviceId_status_idx" ON "DeviceOnboardingQrAsset"("deviceId", "status");

CREATE INDEX "DeviceProvisioningAudit_deviceId_createdAt_idx" ON "DeviceProvisioningAudit"("deviceId", "createdAt");
CREATE INDEX "DeviceProvisioningAudit_workflowId_createdAt_idx" ON "DeviceProvisioningAudit"("workflowId", "createdAt");

ALTER TABLE "DeviceCertificateAsset"
  ADD CONSTRAINT "DeviceCertificateAsset_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceOnboardingQrAsset"
  ADD CONSTRAINT "DeviceOnboardingQrAsset_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceOnboardingQrAsset"
  ADD CONSTRAINT "DeviceOnboardingQrAsset_certificateAssetId_fkey"
  FOREIGN KEY ("certificateAssetId") REFERENCES "DeviceCertificateAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceProvisioningAudit"
  ADD CONSTRAINT "DeviceProvisioningAudit_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
