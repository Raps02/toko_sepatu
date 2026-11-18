import type { OrderStatus, Prisma } from '@prisma/client';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { changeStock } from '@/lib/stock';
import type { Tone } from '@/components/dashboard/PageHeader';

type Tx = Prisma.TransactionClient;

/** Batas waktu bayar; Midtrans diberi masa berlaku yang sama. */
export const PAYMENT_WINDOW_HOURS = 6;

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; customerHint: string }> = {
  PENDING_PAYMENT: { label: 'Menunggu pembayaran', tone: 'warn', customerHint: 'Selesaikan pembayaran sebelum batas waktu supaya pesanan tidak dibatalkan.' },
  PAID: { label: 'Sudah dibayar', tone: 'good', customerHint: 'Pembayaran diterima. Toko akan segera menyiapkan pesananmu.' },
  PROCESSING: { label: 'Sedang disiapkan', tone: 'good', customerHint: 'Pesananmu sedang dikemas.' },
  SHIPPED: { label: 'Dalam pengiriman', tone: 'dark', customerHint: 'Pesanan sudah diserahkan ke kurir. Konfirmasi kalau sudah sampai.' },
  COMPLETED: { label: 'Selesai', tone: 'neutral', customerHint: 'Pesanan sudah diterima.' },
  CANCELLED: { label: 'Dibatalkan', tone: 'bad', customerHint: 'Pesanan ini dibatalkan.' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'bad', customerHint: 'Batas waktu pembayaran terlewat, jadi pesanan dibatalkan otomatis.' },
};

/** Status yang dihitung sebagai penjualan di laporan keuangan. */
export const REVENUE_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

export function generateOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  return `LK-${date}-${random}`;
}

/**
 * Menutup order yang tidak jadi (batal atau kedaluwarsa) dan mengembalikan
 * stoknya. Order diklaim dengan `updateMany` bersyarat status, jadi kalau
 * dipanggil dua kali (webhook + pengecekan berkala) stok hanya kembali sekali.
 */
export async function closeOrder(
  tx: Tx,
  orderId: string,
  options: { to: 'CANCELLED' | 'EXPIRED'; from: OrderStatus[]; actorId: string | null; note?: string },
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: { in: options.from } },
    data: { status: options.to, cancelledAt: new Date() },
  });
  if (claimed.count === 0) return false;

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { orderBy: { variantId: 'asc' } }, payment: true },
  });

  for (const item of order.items) {
    await changeStock(tx, {
      variantId: item.variantId,
      delta: item.quantity,
      type: 'RESTOCK',
      orderId: order.id,
      actorId: options.actorId,
      note: options.to === 'EXPIRED' ? 'Order kedaluwarsa' : 'Order dibatalkan',
    });
  }

  // Pembayaran yang belum masuk ditutup; yang sudah masuk dibiarkan PAID
  // supaya terlihat bahwa dananya masih harus dikembalikan.
  if (order.payment?.status === 'PENDING') {
    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: options.to === 'EXPIRED' ? 'EXPIRED' : 'FAILED' },
    });
  }

  await logAudit(tx, {
    actorId: options.actorId,
    action: 'order.cancel',
    entity: 'Order',
    entityId: order.id,
    after: { orderNumber: order.orderNumber, status: options.to, note: options.note ?? null },
  });
  return true;
}

type PaymentInfo = { transactionId?: string | null; method?: string | null; rawPayload?: Prisma.InputJsonValue };

/**
 * Mencatat pembayaran yang masuk. Aman dipanggil berulang untuk notifikasi
 * yang sama. Mengembalikan 'late' kalau dana masuk setelah order sudah batal
 * atau kedaluwarsa: stoknya sudah dilepas, jadi order tidak dihidupkan lagi
 * dan dananya perlu dikembalikan manual.
 */
export async function markOrderPaid(tx: Tx, orderId: string, info: PaymentInfo = {}): Promise<'paid' | 'already' | 'late'> {
  const now = new Date();
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID', paidAt: now },
  });

  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
  const alreadyRecorded = order.payment?.status === 'PAID';

  await tx.payment.update({
    where: { orderId },
    data: {
      status: 'PAID',
      paidAt: order.payment?.paidAt ?? now,
      transactionId: info.transactionId ?? order.payment?.transactionId,
      method: info.method ?? order.payment?.method,
      ...(info.rawPayload !== undefined && { rawPayload: info.rawPayload }),
    },
  });

  if (claimed.count === 1) return 'paid';
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    if (!alreadyRecorded) {
      await logAudit(tx, {
        actorId: null,
        action: 'payment.late',
        entity: 'Order',
        entityId: orderId,
        after: { orderNumber: order.orderNumber, note: 'Dana masuk setelah order batal; perlu refund manual' },
      });
    }
    return 'late';
  }
  return 'already';
}

/** Menutup semua order yang melewati batas waktu bayar. Dipanggil saat daftar order dibuka. */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });

  let closed = 0;
  for (const { id } of stale) {
    try {
      const done = await prisma.$transaction((tx) =>
        closeOrder(tx, id, { to: 'EXPIRED', from: ['PENDING_PAYMENT'], actorId: null }),
      );
      if (done) closed += 1;
    } catch (error) {
      console.error('Gagal menutup order kedaluwarsa', id, error);
    }
  }
  return closed;
}

let lastRelease = 0;

/** Melepas stok order kedaluwarsa dari lalu lintas toko, paling sering sekali per menit. */
export async function releaseExpiredStock(): Promise<void> {
  const now = Date.now();
  if (now - lastRelease < 60_000) return;
  lastRelease = now;
  await expireStaleOrders();
}

export function lineTotal(item: { unitPrice: number; discountAmount: number; quantity: number }): number {
  return (item.unitPrice - item.discountAmount) * item.quantity;
}
