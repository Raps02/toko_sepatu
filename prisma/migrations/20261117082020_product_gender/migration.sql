-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('PRIA', 'WANITA', 'UNISEX');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'UNISEX';

-- CreateIndex
CREATE INDEX "products_gender_idx" ON "products"("gender");
