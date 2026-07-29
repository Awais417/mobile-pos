-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isInitialPayment" BOOLEAN NOT NULL DEFAULT false;


-- Backfill: for each existing Sale, the earliest Payment row (by createdAt)
-- is the one that was created at checkout time — mark it as the initial
-- payment now that the column exists.
UPDATE "Payment" p
SET "isInitialPayment" = true
FROM (
  SELECT DISTINCT ON ("saleId") id
  FROM "Payment"
  ORDER BY "saleId", "createdAt" ASC
) AS first_payment
WHERE p.id = first_payment.id;
