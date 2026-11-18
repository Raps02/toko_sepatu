-- Harga modal pindah ke produk. Produk lama diisi dari rata-rata modal variannya.
ALTER TABLE "products" ADD COLUMN "costPrice" INTEGER NOT NULL DEFAULT 0;

UPDATE "products" p
SET "costPrice" = COALESCE(
  (SELECT ROUND(AVG(v."avgCost"))::INTEGER FROM "product_variants" v WHERE v."productId" = p."id" AND v."avgCost" > 0),
  0
);
