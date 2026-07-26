-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill existing rows: no sale before this migration had an edited Grand
-- Total, so its subtotal is simply its recorded total (discountAmount stays 0).
UPDATE "Sale" SET "subtotalAmount" = "totalAmount";
