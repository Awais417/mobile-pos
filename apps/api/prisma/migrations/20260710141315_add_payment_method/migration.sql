/*
  Warnings:

  - Added the required column `paymentMethod` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE_WALLET', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "cardLastFour" TEXT,
ADD COLUMN     "cashReceived" DECIMAL(12,2),
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "referenceNumber" TEXT;
