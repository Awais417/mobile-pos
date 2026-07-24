-- AlterTable: add costPrice (nullable first, for backfill)
ALTER TABLE "SaleItem" ADD COLUMN "costPrice" DECIMAL(12,2);

-- Backfill existing sale items from the current Product.costPrice.
-- Safe for all pre-existing rows because costPrice has never been editable
-- via the API after product creation, so "current" cost equals "cost at time
-- of sale" for every row created before this migration.
UPDATE "SaleItem" si
SET "costPrice" = p."costPrice"
FROM "Product" p
WHERE si."productId" = p.id;

-- Any remaining rows reference a Product that no longer exists (hard-deleted
-- before the archive-safeguard existed). That cost data is unrecoverable —
-- default to 0 so the column can be made NOT NULL.
UPDATE "SaleItem" SET "costPrice" = 0 WHERE "costPrice" IS NULL;

-- Enforce NOT NULL now that every row has a value
ALTER TABLE "SaleItem" ALTER COLUMN "costPrice" SET NOT NULL;
