-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedBy" TEXT;

-- CreateTable
CREATE TABLE "SaleAuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleAuditLog_businessId_idx" ON "SaleAuditLog"("businessId");

-- CreateIndex
CREATE INDEX "SaleAuditLog_saleId_idx" ON "SaleAuditLog"("saleId");

-- AddForeignKey
ALTER TABLE "SaleAuditLog" ADD CONSTRAINT "SaleAuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAuditLog" ADD CONSTRAINT "SaleAuditLog_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
