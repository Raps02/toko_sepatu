import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { fetchTransactionStatus, verifySignature, type MidtransNotification } from '@/lib/midtrans';
import { applyMidtransNotification } from '@/lib/midtrans-sync';
import { prisma } from '@/lib/prisma';

// Notifikasi pembayaran dari Midtrans. Daftarkan URL ini di dashboard Midtrans
// (Settings > Configuration > Payment Notification URL):
//   https://<domain-kamu>/api/webhooks/midtrans
//
// Aturan: balas 2xx hanya kalau notifikasi sudah tercatat, supaya Midtrans
// mengirim ulang kalau kita sedang bermasalah. Memproses notifikasi yang sama
// dua kali tidak mengubah apa-apa.

export const dynamic = 'force-dynamic';

function isNotification(value: unknown): value is MidtransNotification {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return ['order_id', 'status_code', 'gross_amount', 'signature_key', 'transaction_status'].every(
    (key) => typeof v[key] === 'string',
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isNotification(body)) {
    return NextResponse.json({ error: 'Payload tidak dikenali' }, { status: 400 });
  }
  if (!verifySignature(body)) {
    return NextResponse.json({ error: 'Signature tidak valid' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({ where: { orderNumber: body.order_id }, include: { payment: true } });
  if (!order?.payment) {
    // Mis. notifikasi uji dari dashboard Midtrans. Dibalas 200 supaya tidak dikirim ulang.
    return NextResponse.json({ received: true, ignored: 'order tidak dikenal' });
  }

  if (Math.round(Number(body.gross_amount)) !== order.payment.grossAmount) {
    console.error('Nominal notifikasi Midtrans tidak cocok', body.order_id, body.gross_amount, order.payment.grossAmount);
    return NextResponse.json({ error: 'Nominal tidak cocok' }, { status: 400 });
  }

  // Status diambil ulang langsung dari Midtrans; isi notifikasi hanya dipakai
  // kalau pengecekan itu tidak tersedia.
  const confirmed = (await fetchTransactionStatus(order.orderNumber)) ?? body;

  try {
    const result = await applyMidtransNotification(order, confirmed, body);
    if (result.mismatch) {
      return NextResponse.json({ error: 'Nominal tidak cocok' }, { status: 400 });
    }
  } catch (error) {
    console.error('Gagal memproses notifikasi Midtrans', body.order_id, error);
    return NextResponse.json({ error: 'Gagal memproses' }, { status: 500 });
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath(`/orders/${order.id}`);
  revalidatePath('/orders');
  return NextResponse.json({ received: true });
}
