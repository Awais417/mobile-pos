-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add brandId (nullable)
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;

-- Backfill: one Brand row per distinct trimmed Product.brand value, per business
INSERT INTO "Brand" (id, "businessId", name, "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."businessId", t.brand, true, now(), now()
FROM (
  SELECT DISTINCT "businessId", trim(brand) AS brand
  FROM "Product"
  WHERE brand IS NOT NULL AND trim(brand) <> ''
) t;

-- Point Product.brandId at the matching Brand row
UPDATE "Product" p
SET "brandId" = b.id
FROM "Brand" b
WHERE p."businessId" = b."businessId"
  AND p.brand IS NOT NULL
  AND trim(p.brand) = b.name;

-- Drop the old free-text column now that data is preserved relationally
ALTER TABLE "Product" DROP COLUMN "brand";

-- Indexes
CREATE UNIQUE INDEX "Brand_businessId_name_key" ON "Brand"("businessId", "name");
CREATE INDEX "Brand_businessId_idx" ON "Brand"("businessId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- Foreign keys
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cleanup: two leftover 0-product junk categories from before the Category Terminal redesign
DELETE FROM "Category" WHERE name IN ('iphone', 'android ') AND id NOT IN (SELECT DISTINCT "categoryId" FROM "Product");
