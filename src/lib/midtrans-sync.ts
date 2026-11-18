import type { Payment, Prisma } from '@prisma/client';
import {
  fetchTransactionStatus,
  isMidtransConfigured,
  outcomeOf,
  type MidtransNotification,
  type PaymentOutcome,
} from '@/lib/midtrans';
import { closeOrder, markOrderPaid } from '@/lib/orders';
import { after } from 'next/server';
import { sendInvoiceEmail } from '@/lib/invoice-email';
import { prisma } from '@/lib/prisma';

export type SyncOutcome = {
  outcome: PaymentOutcome;
  changed: boolean;
  mismatch?: boolean;
};

/**
 * Menerapkan status transaksi Midtrans yang sudah terverifikasi ke Order & Payment.
 * Dipakai bersama oleh webhook `/api/webhooks/midtrans` maupun sinkronisasi langsung
 * lewat Status API (mis. saat webhook belum sampai di localhost).
 */
export async function applyMidtransNotification(
  order: { id: string; orderNumber: string; payment: Pick<Payment, 'grossAmount' | 'status'> | null },
  confirmed: Pick<MidtransNotification, 'transaction_status' | 'fraud_status' | 'gross_amount' | 'transaction_id' | 'payment_type'>,
  rawPayload: unknown = confirmed,
): Promise<SyncOutcome> {
  if (!order.payment) return { outcome: 'PENDING', changed: false };

  if (typeof confirmed.gross_amount === 'string' && Math.round(Number(confirmed.gross_amount)) !== order.payment.grossAmount) {
    console.error('Nominal notifikasi Midtrans tidak cocok', order.orderNumber, confirmed.gross_amount, order.payment.grossAmount);
    return { outcome: 'PENDING', changed: false, mismatch: true };
  }

  const outcome = outcomeOf(confirmed.transaction_status, confirmed.fraud_status);
  const info = {
    transactionId: confirmed.transaction_id ?? null,
    method: confirmed.payment_type ?? null,
    rawPayload: rawPayload as Prisma.InputJsonValue,
  };

  let changed = false;
  await prisma.$transaction(async (tx) => {
    if (outcome === 'PAID') {
      const result = await markOrderPaid(tx, order.id, info);
      changed = result === 'paid';
    } else if (outcome === 'EXPIRED') {
      changed = await closeOrder(tx, order.id, {
        to: 'EXPIRED',
        from: ['PENDING_PAYMENT'],
        actorId: null,
        note: 'Kedaluwarsa di Midtrans',
      });
    } else if (outcome === 'FAILED') {
      // `deny`/`cancel` atas satu metode bayar belum tentu berarti pembeli menyerah;
      // order tetap menunggu sampai batas waktu, notifikasinya saja yang dicatat.
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { rawPayload: info.rawPayload },
      });
    } else if (outcome === 'REFUNDED') {
      const updated = await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PAID' },
        data: { status: 'REFUNDED', rawPayload: info.rawPayload },
      });
      changed = updated.count > 0;
    }
  });

  // Baru dibayar: invoice PDF dikirim ke email pembeli setelah respons (webhook atau halaman) selesai.
  if (outcome === 'PAID' && changed) after(() => sendInvoiceEmail(order.id));

  return { outcome, changed };
}

/**
 * Mengecek status pembayaran langsung ke Midtrans Status API (`/v2/{order_id}/status`)
 * bila order masih `PENDING_PAYMENT` dan transaksi Snap sudah pernah dibuat.
 */
export async function syncOrderPaymentStatus(orderId: string): Promise<SyncOutcome> {
  if (!isMidtransConfigured()) return { outcome: 'PENDING', changed: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      payment: { select: { grossAmount: true, status: true, snapToken: true } },
    },
  });
  if (!order?.payment || order.status !== 'PENDING_PAYMENT' || !order.payment.snapToken) {
    return { outcome: order?.payment?.status === 'PAID' ? 'PAID' : 'PENDING', changed: false };
  }

  const confirmed = await fetchTransactionStatus(order.orderNumber);
  if (!confirmed) return { outcome: 'PENDING', changed: false };
  if (confirmed.order_id && confirmed.order_id !== order.orderNumber) {
    return { outcome: 'PENDING', changed: false, mismatch: true };
  }

  return applyMidtransNotification(order, confirmed, confirmed);
}

/** Sinkronisasi otomatis untuk order `PENDING_PAYMENT` yang sudah memiliki Snap token. */
export async function syncPendingMidtransOrders(userId?: string): Promise<number> {
  if (!isMidtransConfigured()) return 0;

  const pending = await prisma.order.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: 'PENDING_PAYMENT',
      payment: { is: { snapToken: { not: null } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true },
  });

  if (pending.length === 0) return 0;
  const results = await Promise.all(pending.map((o) => syncOrderPaymentStatus(o.id)));
  return results.filter((r) => r.changed).length;
}
