-- Drop old FK (SET NULL) before making the column NOT NULL
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- Make categoryId required (backfill already guarantees no NULLs)
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- Re-add FK as RESTRICT — a category in use can never be deleted out from under products
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the old fixed enum classification — categoryId is now the single source of truth
ALTER TABLE "Product" DROP COLUMN "productCategory";
DROP TYPE "ProductCategory";
