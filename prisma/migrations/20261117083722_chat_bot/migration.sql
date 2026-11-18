-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "botEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "needsStaff" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_needsStaff_idx" ON "conversations"("needsStaff");

-- Satu chat umum (tanpa produk) per pembeli. Unique biasa tidak berlaku untuk NULL di
-- Postgres, jadi pakai index parsial.
CREATE UNIQUE INDEX "conversations_customerId_general_key" ON "conversations"("customerId") WHERE "productId" IS NULL;

-- Percakapan lama yang sudah pernah dibalas staf tetap ditangani staf, bot tidak ikut menjawab.
UPDATE "conversations" c SET "botEnabled" = false
WHERE EXISTS (
  SELECT 1 FROM "messages" m JOIN "users" u ON u."id" = m."senderId"
  WHERE m."conversationId" = c."id" AND u."role" <> 'CUSTOMER'
);
