-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('IPHONE', 'ANDROID', 'ACCESSORIES');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "color" TEXT,
ADD COLUMN     "compatibility" TEXT,
ADD COLUMN     "productCategory" "ProductCategory" NOT NULL DEFAULT 'ACCESSORIES';
