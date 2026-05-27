ALTER TABLE "public"."Vendor"
ADD COLUMN "protocol" TEXT,
ADD COLUMN "apiVersion" TEXT,
ADD COLUMN "baseUrl" TEXT,
ADD COLUMN "mqttEndpoint" TEXT,
ADD COLUMN "websocketUrl" TEXT,
ADD COLUMN "zigbeeProfile" TEXT,
ADD COLUMN "uid" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "status" TEXT;
