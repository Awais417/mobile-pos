-- CreateEnum
CREATE TYPE "ClientHistoryEntryType" AS ENUM ('SALE', 'PAYMENT', 'RETURN');

-- CreateTable
CREATE TABLE "ClientHistoryHide" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entryType" "ClientHistoryEntryType" NOT NULL,
    "entryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "hiddenBy" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientHistoryHide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientHistoryHide_businessId_idx" ON "ClientHistoryHide"("businessId");

-- CreateIndex
CREATE INDEX "ClientHistoryHide_clientId_idx" ON "ClientHistoryHide"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientHistoryHide_businessId_entryType_entryId_key" ON "ClientHistoryHide"("businessId", "entryType", "entryId");

-- AddForeignKey
ALTER TABLE "ClientHistoryHide" ADD CONSTRAINT "ClientHistoryHide_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHistoryHide" ADD CONSTRAINT "ClientHistoryHide_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

