-- CreateEnum
CREATE TYPE "DeviceCondition" AS ENUM ('BRAND_NEW', 'OPEN_BOX', 'USED', 'REFURBISHED', 'CPO');

-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "deviceCondition" "DeviceCondition" NOT NULL DEFAULT 'BRAND_NEW',
ADD COLUMN     "supplier" TEXT;
