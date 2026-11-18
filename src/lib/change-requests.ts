import type { ChangeRequestType, Prisma } from '@prisma/client';
import { UserFacingError } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { dayRange } from '@/lib/format';
import { changeStock } from '@/lib/stock';
import {
  discountPayload,
  orderCorrectionPayload,
  priceChangePayload,
  stockCorrectionPayload,
} from '@/lib/validations';

type Tx = Prisma.TransactionClient;

export const CHANGE_TYPE_LABEL: Record<ChangeRequestType, string> = {
  PRICE_CHANGE: 'Perubahan harga',
  DISCOUNT: 'Diskon',
  STOCK_CORRECTION: 'Koreksi stok',
  ORDER_CORRECTION: 'Koreksi order',
};

/**
 * Menerapkan sebuah perubahan. Dipakai di dua tempat: saat admin mengubah
 * langsung, dan saat admin menyetujui pengajuan SPV. Dengan begitu kedua jalur
 * menjalankan aturan yang persis sama.
 *
 * `payload` berasal dari kolom Json, jadi bentuknya diperiksa ulang di sini.
 * Mengembalikan path yang perlu di-revalidate.
 */
export async function applyChange(
  tx: Tx,
  type: ChangeRequestType,
  payload: unknown,
  actorId: string,
  /** Alasan perubahan, ikut dicatat di riwayat perubahan. */
  reason: string | null = null,
): Promise<string[]> {
  switch (type) {
    case 'PRICE_CHANGE': {
      const data = priceChangePayload.parse(payload);
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new UserFacingError('Produknya sudah tidak ada, jadi harga tidak bisa diubah.');

      await tx.product.update({ where: { id: product.id }, data: { basePrice: data.newPrice } });
      await logAudit(tx, {
        actorId,
        action: 'price.update',
        entity: 'Product',
        entityId: product.id,
        before: { basePrice: product.basePrice },
        after: { basePrice: data.newPrice, reason },
      });
      return ['/', '/products', `/products/${product.slug}`];
    }

    case 'DISCOUNT': {
      const data = discountPayload.parse(payload);
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new UserFacingError('Produknya sudah tidak ada, jadi diskon tidak bisa dipasang.');

      // Satu produk hanya punya satu diskon aktif; yang baru menggantikan yang lama.
      await tx.discount.updateMany({ where: { productId: product.id, isActive: true }, data: { isActive: false } });
      const discount = await tx.discount.create({
        data: {
          productId: product.id,
          type: data.type,
          value: data.value,
          startsAt: dayRange(data.startsAt).start,
          endsAt: data.endsAt ? dayRange(data.endsAt).end : null,
        },
      });
      await logAudit(tx, {
        actorId,
        action: 'discount.create',
        entity: 'Product',
        entityId: product.id,
        after: { discountId: discount.id, type: data.type, value: data.value, startsAt: data.startsAt, endsAt: data.endsAt, reason },
      });
      return ['/', '/products', `/products/${product.slug}`];
    }

    case 'STOCK_CORRECTION': {
      const data = stockCorrectionPayload.parse(payload);
      // Selisihnya yang diterapkan, bukan angka mutlaknya, supaya penjualan
      // yang terjadi sejak koreksi diajukan tidak ikut terhapus.
      const delta = data.actualStock - data.recordedStock;
      if (delta === 0) return ['/dashboard/stock'];

      const result = await changeStock(tx, {
        variantId: data.variantId,
        delta,
        type: 'ADJUSTMENT',
        actorId,
        note: `Koreksi hitung ulang: tercatat ${data.recordedStock}, sebenarnya ${data.actualStock}`,
        insufficientMessage: (available) =>
          `Koreksi ini mengurangi ${Math.abs(delta)} pasang, padahal stok sekarang tinggal ${available}. Hitung ulang lalu ajukan lagi.`,
      });
      await logAudit(tx, {
        actorId,
        action: 'stock.adjust',
        entity: 'ProductVariant',
        entityId: data.variantId,
        before: { stock: result.stockBefore },
        after: { stock: result.stockAfter, reason },
      });
      return ['/dashboard/stock', '/', '/products'];
    }

    case 'ORDER_CORRECTION': {
      const data = orderCorrectionPayload.parse(payload);
      const order = await tx.order.findUnique({ where: { id: data.orderId } });
      if (!order) throw new UserFacingError('Ordernya sudah tidak ada.');

      await tx.order.update({
        where: { id: order.id },
        data: { courier: data.courier, trackingNumber: data.trackingNumber },
      });
      await logAudit(tx, {
        actorId,
        action: 'order.correct',
        entity: 'Order',
        entityId: order.id,
        before: { courier: order.courier, trackingNumber: order.trackingNumber },
        after: { courier: data.courier, trackingNumber: data.trackingNumber, reason },
      });
      return ['/dashboard/orders', `/dashboard/orders/${order.id}`, `/orders/${order.id}`];
    }
  }
}

type NewRequest = {
  type: ChangeRequestType;
  summary: string;
  payload: Prisma.InputJsonValue;
  reason: string;
  requestedById: string;
};

export async function submitChangeRequest(tx: Tx, request: NewRequest): Promise<void> {
  const created = await tx.changeRequest.create({ data: request });
  await logAudit(tx, {
    actorId: request.requestedById,
    action: 'approval.request',
    entity: 'ChangeRequest',
    entityId: created.id,
    after: { type: request.type, summary: request.summary },
  });
}
