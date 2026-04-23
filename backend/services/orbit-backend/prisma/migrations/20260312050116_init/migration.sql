/*
  Warnings:

  - The primary key for the `Communication` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Device` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `description` on the `Device` table. All the data in the column will be lost.
  - The primary key for the `Item` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `itemTypeName` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `vendorName` on the `Item` table. All the data in the column will be lost.
  - The primary key for the `ItemType` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Message` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Parameter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `description` on the `Parameter` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - The primary key for the `Vendor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `icon` to the `Communication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemType` to the `Communication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `project` to the `Device` table without a default value. This is not possible if the table is not empty.
  - Added the required column `communicationPolicy` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemType` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `communicationPolicy` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Communication" DROP CONSTRAINT "Communication_pkey",
ADD COLUMN     "confirmationMessageStructure" TEXT,
ADD COLUMN     "icon" TEXT NOT NULL,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "itemType" TEXT NOT NULL,
ADD COLUMN     "messageStructure" TEXT,
ADD COLUMN     "needConfirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needFirmware" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Communication_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Communication_id_seq";

-- AlterTable
ALTER TABLE "Device" DROP CONSTRAINT "Device_pkey",
DROP COLUMN "description",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "addressDetails" TEXT,
ADD COLUMN     "block" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "foreignId" TEXT,
ADD COLUMN     "gatewayForeignId" TEXT,
ADD COLUMN     "houseNo" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "project" TEXT NOT NULL,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Device_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Device_id_seq";

-- AlterTable
ALTER TABLE "Item" DROP CONSTRAINT "Item_pkey",
DROP COLUMN "itemTypeName",
DROP COLUMN "vendorName",
ADD COLUMN     "communicationPolicy" TEXT NOT NULL,
ADD COLUMN     "componentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "itemPollingConfig" TEXT,
ADD COLUMN     "itemType" TEXT NOT NULL,
ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "tags" TEXT,
ADD COLUMN     "vendor" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "gateway" DROP NOT NULL,
ALTER COLUMN "gateway" DROP DEFAULT,
ALTER COLUMN "gateway" SET DATA TYPE TEXT,
ADD CONSTRAINT "Item_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Item_id_seq";

-- AlterTable
ALTER TABLE "ItemType" DROP CONSTRAINT "ItemType_pkey",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ItemType_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ItemType_id_seq";

-- AlterTable
ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey",
ADD COLUMN     "commandType" TEXT,
ADD COLUMN     "communicationPolicy" TEXT NOT NULL,
ADD COLUMN     "confirmationPayloadFormat" TEXT,
ADD COLUMN     "payloadFormat" TEXT,
ADD COLUMN     "pollingInterval" INTEGER,
ADD COLUMN     "qos" INTEGER,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "messageType" DROP NOT NULL,
ALTER COLUMN "policyType" DROP NOT NULL,
ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Message_id_seq";

-- AlterTable
ALTER TABLE "Parameter" DROP CONSTRAINT "Parameter_pkey",
DROP COLUMN "description",
ADD COLUMN     "isConstant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendors" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "variableType" DROP NOT NULL,
ALTER COLUMN "pinType" DROP NOT NULL,
ADD CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Parameter_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "password",
DROP COLUMN "role",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- AlterTable
ALTER TABLE "Vendor" DROP CONSTRAINT "Vendor_pkey",
ADD COLUMN     "apiToken" TEXT,
ADD COLUMN     "authorizationUrl" TEXT,
ADD COLUMN     "certificate" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientSecret" TEXT,
ADD COLUMN     "jwtToken" TEXT,
ADD COLUMN     "privateKey" TEXT,
ADD COLUMN     "publicKey" TEXT,
ADD COLUMN     "redirectUri" TEXT,
ADD COLUMN     "tokenType" TEXT,
ADD COLUMN     "tokenUrl" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "industry" DROP NOT NULL,
ALTER COLUMN "authType" DROP NOT NULL,
ADD CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Vendor_id_seq";
