import type { Prisma, StockMovementType } from '@prisma/client';
import { UserFacingError } from '@/lib/action-helpers';
import { movingAverageCost } from '@/lib/pricing';

type Tx = Prisma.TransactionClient;
type LockedVariant = { id: string; stock: number; avgCost: number };

type StockChange = {
  variantId: string;
  /** Selisih bertanda: positif menambah, negatif mengurangi. */
  delta: number;
  type: StockMovementType;
  actorId: string | null;
  note?: string | null;
  /** Harga modal per pasang; wajib untuk barang masuk supaya rata-rata modal ikut diperbarui. */
  unitCost?: number | null;
  orderId?: string | null;
  /** Pesan kalau stok tidak cukup. */
  insufficientMessage?: (available: number) => string;
};

/**
 * Satu-satunya jalan mengubah stok. Baris varian dikunci (`FOR UPDATE`) selama
 * transaksi, jadi dua perubahan bersamaan diproses bergantian dan stok tidak
 * bisa menjadi negatif atau terjual dua kali. Setiap perubahan meninggalkan
 * satu baris StockMovement.
 */
export async function changeStock(tx: Tx, change: StockChange) {
  const rows = await tx.$queryRaw<LockedVariant[]>`
    SELECT id, stock, "avgCost" FROM product_variants WHERE id = ${change.variantId} FOR UPDATE
  `;
  const variant = rows[0];
  if (!variant) throw new UserFacingError('Varian tidak ditemukan. Mungkin sudah dihapus.');

  const stockAfter = variant.stock + change.delta;
  if (stockAfter < 0) {
    throw new UserFacingError(
      change.insufficientMessage?.(variant.stock) ??
        `Stok tidak cukup: tersisa ${variant.stock} pasang, diminta ${Math.abs(change.delta)}.`,
    );
  }

  const avgCost =
    change.type === 'IN' && change.unitCost != null
      ? movingAverageCost(variant.stock, variant.avgCost, change.delta, change.unitCost)
      : variant.avgCost;

  await tx.productVariant.update({ where: { id: variant.id }, data: { stock: stockAfter, avgCost } });
  await tx.stockMovement.create({
    data: {
      variantId: variant.id,
      type: change.type,
      quantity: change.delta,
      stockAfter,
      unitCost: change.unitCost ?? null,
      note: change.note ?? null,
      orderId: change.orderId ?? null,
      createdById: change.actorId,
    },
  });

  return { stockBefore: variant.stock, stockAfter, avgCost };
}

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  IN: 'Barang masuk',
  OUT: 'Barang keluar',
  SALE: 'Terjual',
  RESTOCK: 'Kembali ke stok',
  ADJUSTMENT: 'Koreksi',
};
