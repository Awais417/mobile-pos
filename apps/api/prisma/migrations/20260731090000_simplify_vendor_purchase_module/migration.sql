-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseStatus_new" AS ENUM ('ACTIVE', 'CANCELLED');
ALTER TABLE "Purchase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Purchase" ALTER COLUMN "status" TYPE "PurchaseStatus_new" USING ("status"::text::"PurchaseStatus_new");
ALTER TYPE "PurchaseStatus" RENAME TO "PurchaseStatus_old";
ALTER TYPE "PurchaseStatus_new" RENAME TO "PurchaseStatus";
DROP TYPE "PurchaseStatus_old";
ALTER TABLE "Purchase" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "VendorLedgerEntry" DROP CONSTRAINT "VendorLedgerEntry_businessId_fkey";

-- DropForeignKey
ALTER TABLE "VendorLedgerEntry" DROP CONSTRAINT "VendorLedgerEntry_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "VendorLedgerEntry" DROP CONSTRAINT "VendorLedgerEntry_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "VendorLedgerEntry" DROP CONSTRAINT "VendorLedgerEntry_vendorPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "VendorPaymentAllocation" DROP CONSTRAINT "VendorPaymentAllocation_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "VendorPaymentAllocation" DROP CONSTRAINT "VendorPaymentAllocation_vendorPaymentId_fkey";

-- DropIndex
DROP INDEX "PurchaseItem_productId_idx";

-- Data preservation: backfill any pre-existing null Vendor.phone from
-- contactPerson (the only other free-text contact field that existed)
-- before contactPerson is dropped and phone becomes required. Safe no-op
-- when every vendor already has a phone.
UPDATE "Vendor" SET "phone" = "contactPerson" WHERE "phone" IS NULL AND "contactPerson" IS NOT NULL;
UPDATE "Vendor" SET "phone" = '' WHERE "phone" IS NULL;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "additionalCharges",
DROP COLUMN "advanceApplied",
DROP COLUMN "discountAmount",
DROP COLUMN "receivedAt",
DROP COLUMN "receivedBy",
DROP COLUMN "subtotalAmount",
DROP COLUMN "vendorInvoiceNumber",
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable — PurchaseItem has no existing rows in any environment this
-- migration has been tested against, so itemName can safely become NOT NULL
-- directly.
ALTER TABLE "PurchaseItem" DROP COLUMN "isSerialized",
DROP COLUMN "productId",
DROP COLUMN "productName",
DROP COLUMN "serialUnits",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "itemName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PurchaseItem" ALTER COLUMN "itemName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "contactPerson",
DROP COLUMN "creditLimit",
DROP COLUMN "email",
DROP COLUMN "openingBalance",
DROP COLUMN "paymentTerms",
DROP COLUMN "taxNumber",
DROP COLUMN "whatsapp",
ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable — purchaseId is nullable at the database level only so that a
-- pre-existing standalone VendorPayment row (recorded before this field
-- existed, with no purchase to attach to) is preserved rather than deleted;
-- every payment created through the API always sets it (enforced in DTOs).
ALTER TABLE "VendorPayment" ADD COLUMN     "deductFromDashboardCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInitialPayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseId" TEXT;

-- DropTable
DROP TABLE "VendorLedgerEntry";

-- DropTable
DROP TABLE "VendorPaymentAllocation";

-- DropEnum
DROP TYPE "VendorLedgerType";

-- CreateIndex
CREATE INDEX "VendorPayment_purchaseId_idx" ON "VendorPayment"("purchaseId");

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
