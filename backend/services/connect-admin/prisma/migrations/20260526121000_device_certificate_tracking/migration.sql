ALTER TABLE "Device"
  ADD COLUMN "certificateId" TEXT,
  ADD COLUMN "certificateArn" TEXT,
  ADD COLUMN "certificateBucket" TEXT,
  ADD COLUMN "certificateRegion" TEXT,
  ADD COLUMN "certificateVersion" INTEGER,
  ADD COLUMN "certificateKey" TEXT,
  ADD COLUMN "privateKeyKey" TEXT,
  ADD COLUMN "publicKeyKey" TEXT,
  ADD COLUMN "metadataKey" TEXT,
  ADD COLUMN "lastProvisionedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Device_thingId_key" ON "Device"("thingId");
CREATE UNIQUE INDEX "Device_certificateId_key" ON "Device"("certificateId");
