-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "paymentMethod" DROP DEFAULT;
