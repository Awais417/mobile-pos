-- CreateEnum
CREATE TYPE "CustomerRefundStatus" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isRefund" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomerRefund" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CustomerRefundStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod",
    "referenceNumber" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_saleReturnId_key" ON "CustomerRefund"("saleReturnId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_paymentId_key" ON "CustomerRefund"("paymentId");

-- CreateIndex
CREATE INDEX "CustomerRefund_businessId_idx" ON "CustomerRefund"("businessId");

-- CreateIndex
CREATE INDEX "CustomerRefund_saleId_idx" ON "CustomerRefund"("saleId");

-- CreateIndex
CREATE INDEX "CustomerRefund_clientId_idx" ON "CustomerRefund"("clientId");

-- CreateIndex
CREATE INDEX "CustomerRefund_status_idx" ON "CustomerRefund"("status");

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

