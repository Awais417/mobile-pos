-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorLedgerType" AS ENUM ('OPENING_BALANCE', 'PURCHASE', 'PAYMENT', 'REVERSAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE 'BRANCH_MANAGER';

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(12,2),
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "outletId" TEXT,
    "purchaseNumber" INTEGER NOT NULL,
    "vendorInvoiceNumber" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "advanceApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "isSerialized" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "serialUnits" JSONB,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT,
    "bankName" TEXT,
    "referenceNumber" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentAllocation" (
    "id" TEXT NOT NULL,
    "vendorPaymentId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorLedgerEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "VendorLedgerType" NOT NULL,
    "purchaseId" TEXT,
    "vendorPaymentId" TEXT,
    "description" TEXT NOT NULL,
    "purchaseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "runningBalance" DECIMAL(12,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_businessId_idx" ON "Vendor"("businessId");

-- CreateIndex
CREATE INDEX "Vendor_businessId_isActive_idx" ON "Vendor"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Purchase_businessId_idx" ON "Purchase"("businessId");

-- CreateIndex
CREATE INDEX "Purchase_businessId_status_idx" ON "Purchase"("businessId", "status");

-- CreateIndex
CREATE INDEX "Purchase_vendorId_idx" ON "Purchase"("vendorId");

-- CreateIndex
CREATE INDEX "Purchase_outletId_idx" ON "Purchase"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_businessId_purchaseNumber_key" ON "Purchase"("businessId", "purchaseNumber");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "VendorPayment_businessId_idx" ON "VendorPayment"("businessId");

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_idx" ON "VendorPayment"("vendorId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_vendorPaymentId_idx" ON "VendorPaymentAllocation"("vendorPaymentId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_purchaseId_idx" ON "VendorPaymentAllocation"("purchaseId");

-- CreateIndex
CREATE INDEX "VendorLedgerEntry_businessId_idx" ON "VendorLedgerEntry"("businessId");

-- CreateIndex
CREATE INDEX "VendorLedgerEntry_vendorId_idx" ON "VendorLedgerEntry"("vendorId");

-- CreateIndex
CREATE INDEX "VendorLedgerEntry_vendorId_createdAt_idx" ON "VendorLedgerEntry"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

