-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "modelId" TEXT;

-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "ram" TEXT,
ADD COLUMN     "serialNumber" TEXT,
ALTER COLUMN "imei1" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Model_businessId_idx" ON "Model"("businessId");

-- CreateIndex
CREATE INDEX "Model_categoryId_idx" ON "Model"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Model_categoryId_name_key" ON "Model"("categoryId", "name");

-- CreateIndex
CREATE INDEX "Product_modelId_idx" ON "Product"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_businessId_serialNumber_key" ON "ProductUnit"("businessId", "serialNumber");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

