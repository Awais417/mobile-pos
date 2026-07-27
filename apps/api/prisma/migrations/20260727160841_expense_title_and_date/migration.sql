-- AlterTable: add as nullable first so existing rows don't break the NOT NULL constraint
ALTER TABLE "Expense" ADD COLUMN "title" TEXT;
ALTER TABLE "Expense" ADD COLUMN "date" TIMESTAMP(3);

-- Backfill existing rows: no expense before this migration had a title or a
-- separate date, so fall back to its note (or a generic label) and its
-- original createdAt.
UPDATE "Expense"
SET "title" = COALESCE(NULLIF("note", ''), 'Expense'),
    "date" = "createdAt"
WHERE "title" IS NULL;

-- Now that every row has a value, enforce NOT NULL going forward
ALTER TABLE "Expense" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "date" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
