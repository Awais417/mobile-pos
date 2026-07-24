-- DropForeignKey
ALTER TABLE "Brand" DROP CONSTRAINT "Brand_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_brandId_fkey";

-- DropIndex
DROP INDEX "Product_brandId_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brandId";

-- DropTable
DROP TABLE "Brand";

