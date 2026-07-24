-- CreateIndex
CREATE INDEX "Product_businessId_isActive_idx" ON "Product"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Product_businessId_createdAt_idx" ON "Product"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductUnit_businessId_status_idx" ON "ProductUnit"("businessId", "status");

-- CreateIndex
CREATE INDEX "ProductUnit_businessId_createdAt_idx" ON "ProductUnit"("businessId", "createdAt");
