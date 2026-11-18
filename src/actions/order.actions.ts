'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fail, failFrom, ok, parseForm, UserFacingError } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { applyChange, submitChangeRequest } from '@/lib/change-requests';
import { hasInvoice } from '@/lib/invoice';
import { buildInvoice, sendInvoiceEmail } from '@/lib/invoice-email';
import { createSnapTransaction, isMidtransConfigured } from '@/lib/midtrans';
import { syncOrderPaymentStatus } from '@/lib/midtrans-sync';
import { unpaidLimitError } from '@/lib/order-limits';
import { closeOrder, expireStaleOrders, generateOrderNumber, markOrderPaid, PAYMENT_WINDOW_HOURS } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { resolvePrice, shippingCostFor, sumCart, totalPairs } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { checkoutRule, clientIp, consumeLimit } from '@/lib/rate-limit';
import { requireAnyPermission, requirePermission } from '@/lib/session';
import { changeStock } from '@/lib/stock';
import { checkoutSchema, orderCorrectionSchema, shipOrderSchema } from '@/lib/validations';
import type { ActionResponse, InvoiceDownloadResponse } from '@/types';

function revalidateOrders(orderId?: string) {
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/orders');
  revalidatePath('/', 'layout');
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Pembayaran contoh hanya ada di development dan hanya selama Midtrans belum diisi. */
function canSimulatePayment(): boolean {
  return process.env.NODE_ENV !== 'production' && !isMidtransConfigured();
}

/**
 * Alamat halaman pembayaran Midtrans untuk sebuah order. Token dibuat sekali
 * lalu disimpan, karena Midtrans menolak order_id yang sama dibuat dua kali.
 */
async function ensurePaymentUrl(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, user: { select: { name: true, email: true, phone: true } } },
  });
  if (!order?.payment || order.status !== 'PENDING_PAYMENT') return null;
  if (order.payment.redirectUrl) return order.payment.redirectUrl;
  if (!isMidtransConfigured()) return null;

  const minutesLeft = (order.expiresAt.getTime() - Date.now()) / 60_000;
  if (minutesLeft < 1) return null;

  const items = order.items.map((item) => ({
    id: item.variantId,
    name: `${item.productName} ${item.color} ${item.size}`,
    price: item.unitPrice - item.discountAmount,
    quantity: item.quantity,
  }));
  if (order.shippingCost > 0) {
    items.push({ id: 'ONGKIR', name: 'Ongkos kirim', price: order.shippingCost, quantity: 1 });
  }

  const snap = await createSnapTransaction({
    orderNumber: order.orderNumber,
    grossAmount: order.total,
    items,
    customer: { name: order.user.name, email: order.user.email, phone: order.shipPhone },
    expiryMinutes: minutesLeft,
    finishUrl: `${appUrl()}/orders/${order.id}`,
  });

  await prisma.payment.update({
    where: { id: order.payment.id },
    data: { snapToken: snap.token, redirectUrl: snap.redirectUrl },
  });
  return snap.redirectUrl;
}

// ───────────────────────── Customer ─────────────────────────

export async function checkoutAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(checkoutSchema, formData);
  if (invalid) return invalid;

  if (!(await consumeLimit(checkoutRule(clientIp(await headers()))))) {
    return fail('Terlalu banyak pesanan dari jaringan ini. Coba lagi nanti.');
  }
  await expireStaleOrders();

  const address = await prisma.address.findFirst({ where: { id: data.addressId, userId: user.id } });
  if (!address) return fail('Alamat pengiriman tidak ditemukan. Pilih alamat lain atau tambah alamat baru.');

  const buyNow = data.buyVariantId ? { variantId: data.buyVariantId, quantity: data.buyQuantity ?? 1 } : null;

  const rate = await prisma.shippingRate.findFirst({
    where: { province: { equals: address.province, mode: 'insensitive' } },
  });
  if (!rate) return fail(`Toko belum melayani pengiriman ke ${address.province}. Pilih alamat di provinsi lain.`);

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Diurutkan per varian supaya dua checkout bersamaan mengunci stok
      // dengan urutan yang sama dan tidak saling menunggu (deadlock).
      const variantInclude = { product: { include: { discounts: { where: { isActive: true } } } } } as const;
      let cart: { quantity: number; variant: Prisma.ProductVariantGetPayload<{ include: typeof variantInclude }> }[];
      if (buyNow) {
        const variant = await tx.productVariant.findUnique({ where: { id: buyNow.variantId }, include: variantInclude });
        if (!variant) throw new UserFacingError('Sepatu ini sudah tidak dijual. Pilih ukuran lain dari halaman produk.');
        cart = [{ quantity: buyNow.quantity, variant }];
      } else {
        cart = await tx.cartItem.findMany({
          where: { userId: user.id },
          orderBy: { variantId: 'asc' },
          include: { variant: { include: variantInclude } },
        });
        if (cart.length === 0) throw new UserFacingError('Keranjangmu kosong.');
      }

      const now = new Date();
      // Harga dihitung ulang di server; angka dari browser tidak dipakai sama sekali.
      const lines = cart.map((item) => {
        const { variant } = item;
        if (!variant.isActive || !variant.product.isPublished) {
          throw new UserFacingError(
            `${variant.product.name} ukuran ${variant.size} sudah tidak dijual.${buyNow ? '' : ' Hapus dari keranjang untuk melanjutkan.'}`,
          );
        }
        const price = resolvePrice(variant.product.basePrice, variant.product.discounts, now);
        return {
          variantId: variant.id,
          productId: variant.productId,
          productName: variant.product.name,
          size: variant.size,
          color: variant.color,
          unitPrice: price.basePrice,
          discountAmount: price.discountAmount,
          unitCost: variant.avgCost,
          quantity: item.quantity,
        };
      });
      // Baris akun dikunci, supaya checkout bersamaan tidak bisa melewati batas ini.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const unpaid = await tx.order.findMany({
        where: { userId: user.id, status: 'PENDING_PAYMENT' },
        select: { items: { select: { quantity: true } } },
      });
      const unpaidPairs = unpaid.reduce((sum, order) => sum + totalPairs(order.items), 0);
      const limitError = unpaidLimitError(unpaid.length, unpaidPairs, totalPairs(lines));
      if (limitError) throw new UserFacingError(limitError);

      const totals = sumCart(lines, shippingCostFor(rate.cost, totalPairs(lines)));

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(now),
          userId: user.id,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          shippingCost: totals.shippingCost,
          total: totals.total,
          shipRecipient: address.recipient,
          shipPhone: address.phone,
          shipStreet: address.street,
          shipCity: address.city,
          shipProvince: address.province,
          shipPostalCode: address.postalCode,
          note: data.note ?? null,
          expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000),
          items: { create: lines },
          payment: { create: { grossAmount: totals.total } },
        },
      });

      // Stok dikunci dan dikurangi di sini. Kalau ada yang kurang, seluruh
      // transaksi batal: order tidak terbuat dan keranjang tetap utuh.
      for (const line of lines) {
        await changeStock(tx, {
          variantId: line.variantId,
          delta: -line.quantity,
          type: 'SALE',
          orderId: created.id,
          actorId: user.id,
          insufficientMessage: (available) =>
            available === 0
              ? `${line.productName} ukuran ${line.size} baru saja habis.${buyNow ? '' : ' Hapus dari keranjang untuk melanjutkan.'}`
              : `${line.productName} ukuran ${line.size} tinggal ${available} pasang. ${buyNow ? 'Kurangi jumlahnya.' : 'Kurangi jumlahnya di keranjang.'}`,
        });
      }

      // Beli Sekarang tidak mengubah keranjang.
      if (!buyNow) await tx.cartItem.deleteMany({ where: { userId: user.id } });
      return created;
    });
    orderId = order.id;
  } catch (error) {
    return failFrom(error, 'Pesanan belum bisa dibuat. Coba lagi sebentar lagi.');
  }

  revalidateOrders(orderId);

  // Order sudah aman tersimpan. Kalau Midtrans sedang bermasalah, pembeli
  // tetap sampai ke halaman pesanan dan bisa menekan "Bayar" dari sana.
  let paymentUrl: string | null = null;
  try {
    paymentUrl = await ensurePaymentUrl(orderId);
  } catch (error) {
    console.error('Gagal membuat transaksi Midtrans untuk order', orderId, error);
  }
  redirect(paymentUrl ?? `/orders/${orderId}`);
}

export async function payOrderAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
  if (!order) return fail('Pesanan tidak ditemukan.');
  if (order.status !== 'PENDING_PAYMENT') return fail('Pesanan ini tidak sedang menunggu pembayaran.');
  if (order.expiresAt.getTime() <= Date.now()) return fail('Batas waktu pembayaran sudah lewat. Buat pesanan baru.');

  if (!isMidtransConfigured()) {
    return fail('Pembayaran online belum diaktifkan toko. Hubungi toko lewat chat produk untuk bantuan.');
  }

  // Pastikan status di Midtrans belum lunas (mis. sudah dibayar di Simulator tapi webhook belum masuk).
  const synced = await syncOrderPaymentStatus(order.id);
  if (synced.outcome === 'PAID') {
    revalidateOrders(order.id);
    return ok('Pembayaran sudah diterima oleh Midtrans. Status pesanan diperbarui.');
  }
  if (synced.outcome === 'EXPIRED') {
    revalidateOrders(order.id);
    return fail('Batas waktu pembayaran sudah lewat di Midtrans. Buat pesanan baru.');
  }

  let paymentUrl: string | null;
  try {
    paymentUrl = await ensurePaymentUrl(order.id);
  } catch (error) {
    return failFrom(error, 'Halaman pembayaran belum bisa dibuka. Coba lagi beberapa saat lagi.');
  }
  if (!paymentUrl) return fail('Halaman pembayaran belum bisa dibuka. Coba lagi beberapa saat lagi.');
  redirect(paymentUrl);
}

export async function refreshPaymentStatusAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) return fail('Pesanan tidak ditemukan.');
  if (order.status !== 'PENDING_PAYMENT') {
    revalidateOrders(order.id);
    return ok('Status pesanan sudah diperbarui.');
  }
  if (!isMidtransConfigured()) {
    return fail('Pembayaran online belum diaktifkan toko.');
  }

  const synced = await syncOrderPaymentStatus(order.id);
  revalidateOrders(order.id);

  if (synced.outcome === 'PAID') return ok('Pembayaran sudah diterima oleh Midtrans.');
  if (synced.outcome === 'EXPIRED') return fail('Batas waktu pembayaran sudah lewat di Midtrans.');
  return ok('Pembayaran masih menunggu konfirmasi di Midtrans.');
}

/** Hanya untuk development tanpa kunci Midtrans: menandai order sendiri sebagai dibayar. */
export async function simulatePaymentAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;
  if (!canSimulatePayment()) return fail('Pembayaran contoh hanya tersedia di mode development tanpa Midtrans.');

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id, status: 'PENDING_PAYMENT' } });
  if (!order) return fail('Pesanan tidak ditemukan atau tidak sedang menunggu pembayaran.');

  try {
    const result = await prisma.$transaction((tx) =>
      markOrderPaid(tx, order.id, { method: 'simulasi', transactionId: `SIM-${order.orderNumber}` }),
    );
    // Invoice dikirim ke email setelah respons, supaya pembeli tidak menunggu.
    if (result === 'paid') after(() => sendInvoiceEmail(order.id));
  } catch (error) {
    return failFrom(error, 'Pembayaran contoh gagal dicatat.');
  }

  revalidateOrders(order.id);
  return ok('Pembayaran contoh dicatat.');
}

export async function cancelMyOrderAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { id: true } });
  if (!order) return fail('Pesanan tidak ditemukan.');

  try {
    const closed = await prisma.$transaction((tx) =>
      closeOrder(tx, order.id, { to: 'CANCELLED', from: ['PENDING_PAYMENT'], actorId: user.id, note: 'Dibatalkan pembeli' }),
    );
    if (!closed) return fail('Pesanan yang sudah dibayar tidak bisa dibatalkan dari sini. Hubungi toko lewat chat.');
  } catch (error) {
    return failFrom(error, 'Pesanan belum bisa dibatalkan.');
  }

  revalidateOrders(order.id);
  return ok('Pesanan dibatalkan.');
}

export async function confirmReceivedAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const updated = await prisma.order.updateMany({
    where: { id: orderId, userId: user.id, status: 'SHIPPED' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  if (updated.count === 0) return fail('Pesanan ini belum dikirim atau sudah selesai.');

  revalidateOrders(orderId);
  return ok('Terima kasih. Pesanan ditandai sudah diterima.');
}

/**
 * Invoice PDF untuk pesanan milik sendiri yang sudah dibayar. Dikembalikan
 * sebagai base64 supaya bisa lewat Server Action; browser yang menyimpannya.
 */
export async function downloadInvoiceAction(orderId: string): Promise<InvoiceDownloadResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return { success: false, message: denied.message ?? 'Akun kamu tidak punya izin untuk tindakan ini.' };

  // `userId` di where: pembeli hanya bisa mengunduh invoice pesanannya sendiri.
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true, payment: { select: { method: true } }, user: { select: { name: true, email: true } } },
  });
  if (!order) return { success: false, message: 'Pesanan tidak ditemukan.' };
  if (!hasInvoice(order.status)) {
    return { success: false, message: 'Invoice tersedia setelah pembayaran pesanan ini diterima.' };
  }

  try {
    const invoice = await buildInvoice(order.id, user.id);
    if (!invoice) return { success: false, message: 'Pesanan tidak ditemukan.' };
    return { success: true, filename: invoice.filename, base64: Buffer.from(invoice.pdf).toString('base64') };
  } catch (error) {
    console.error('Gagal membuat invoice untuk order', order.id, error);
    return { success: false, message: 'Invoice belum bisa dibuat. Coba lagi sebentar lagi.' };
  }
}

/** Kirim ulang invoice PDF ke email pembeli (tombol di halaman pesanan). */
export async function resendInvoiceEmailAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { status: true } });
  if (!order) return fail('Pesanan tidak ditemukan.');
  if (!hasInvoice(order.status)) return fail('Invoice tersedia setelah pembayaran pesanan ini diterima.');

  const result = await sendInvoiceEmail(orderId, 'resend', user.id);
  if (result.sent) return ok(`Invoice sudah dikirim ke ${user.email}. Cek kotak masuk dan folder spam.`);
  if (result.reason === 'cooldown') return fail('Invoice baru saja dikirim. Tunggu sebentar sebelum kirim lagi.');
  if (result.reason === 'not-configured') return fail('Pengiriman email belum disetel di toko ini (BREVO_API_KEY kosong).');
  return fail('Invoice belum bisa dikirim. Coba lagi beberapa menit lagi.');
}

// ───────────────────────── Admin & SPV ─────────────────────────

export async function processOrderAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('order.process');
  if (denied) return denied;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PAID' },
        data: { status: 'PROCESSING', processedAt: new Date() },
      });
      if (updated.count === 0) throw new UserFacingError('Order ini tidak dalam status “Sudah dibayar”. Muat ulang halaman.');
      await logAudit(tx, { actorId: user.id, action: 'order.process', entity: 'Order', entityId: orderId });
    });
  } catch (error) {
    return failFrom(error, 'Order belum bisa diproses.');
  }

  revalidateOrders(orderId);
  return ok('Order ditandai sedang disiapkan.');
}

export async function shipOrderAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('order.process');
  if (denied) return denied;

  const { data, invalid } = parseForm(shipOrderSchema, formData);
  if (invalid) return invalid;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: data.orderId, status: { in: ['PAID', 'PROCESSING'] } },
        data: { status: 'SHIPPED', shippedAt: new Date(), courier: data.courier, trackingNumber: data.trackingNumber },
      });
      if (updated.count === 0) throw new UserFacingError('Order ini belum dibayar atau sudah dikirim. Muat ulang halaman.');
      await logAudit(tx, {
        actorId: user.id,
        action: 'order.ship',
        entity: 'Order',
        entityId: data.orderId,
        after: { courier: data.courier, trackingNumber: data.trackingNumber },
      });
    });
  } catch (error) {
    return failFrom(error, 'Pengiriman belum bisa dicatat.');
  }

  revalidateOrders(data.orderId);
  return ok('Order ditandai sudah dikirim.');
}

export async function completeOrderAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('order.process');
  if (denied) return denied;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'SHIPPED' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (updated.count === 0) throw new UserFacingError('Order ini belum dikirim atau sudah selesai.');
      await logAudit(tx, { actorId: user.id, action: 'order.complete', entity: 'Order', entityId: orderId });
    });
  } catch (error) {
    return failFrom(error, 'Order belum bisa diselesaikan.');
  }

  revalidateOrders(orderId);
  return ok('Order ditandai selesai.');
}

/** Membatalkan order yang belum dikirim. Stok kembali; dana yang sudah masuk direfund manual. */
export async function cancelOrderAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('order.process');
  if (denied) return denied;

  try {
    const closed = await prisma.$transaction((tx) =>
      closeOrder(tx, orderId, {
        to: 'CANCELLED',
        from: ['PENDING_PAYMENT', 'PAID', 'PROCESSING'],
        actorId: user.id,
        note: 'Dibatalkan toko',
      }),
    );
    if (!closed) return fail('Order yang sudah dikirim atau selesai tidak bisa dibatalkan. Gunakan alur retur.');
  } catch (error) {
    return failFrom(error, 'Order belum bisa dibatalkan.');
  }

  revalidateOrders(orderId);
  return ok('Order dibatalkan dan stoknya dikembalikan.');
}

/** Koreksi kurir/resi setelah dikirim: admin langsung berlaku, SPV menjadi pengajuan. */
export async function correctShippingAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requireAnyPermission(['order.correct.apply', 'order.correct.request']);
  if (denied) return denied;

  const { data, invalid } = parseForm(orderCorrectionSchema, formData);
  if (invalid) return invalid;

  const order = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!order) return fail('Order tidak ditemukan.');
  if (order.status !== 'SHIPPED' && order.status !== 'COMPLETED') {
    return fail('Koreksi hanya untuk order yang sudah dikirim. Sebelum dikirim, isi kurir dan resi lewat tombol kirim.');
  }
  if (order.courier === data.courier && order.trackingNumber === data.trackingNumber) {
    return fail('Kurir dan nomor resi sama dengan yang sudah tercatat.');
  }

  const payload = {
    orderId: order.id,
    courier: data.courier,
    trackingNumber: data.trackingNumber,
    oldCourier: order.courier,
    oldTrackingNumber: order.trackingNumber,
  };
  const summary = `Order ${order.orderNumber}: ${order.courier ?? '-'} ${order.trackingNumber ?? '-'} → ${data.courier} ${data.trackingNumber}`;

  try {
    if (can(user.role, 'order.correct.apply')) {
      await prisma.$transaction((tx) => applyChange(tx, 'ORDER_CORRECTION', payload, user.id, data.reason));
      revalidateOrders(order.id);
      return ok('Data pengiriman diperbarui.');
    }

    await prisma.$transaction((tx) =>
      submitChangeRequest(tx, { type: 'ORDER_CORRECTION', summary, payload, reason: data.reason, requestedById: user.id }),
    );
    revalidateOrders(order.id);
    return ok('Koreksi diajukan. Data berubah setelah admin menyetujuinya.');
  } catch (error) {
    return failFrom(error, 'Koreksi belum bisa disimpan.');
  }
}

/** Admin menandai dana order yang dibatalkan sudah dikembalikan ke pembeli. */
export async function markPaymentRefundedAction(orderId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('order.correct.apply');
  if (denied) return denied;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { orderId, status: 'PAID', order: { status: { in: ['CANCELLED', 'EXPIRED'] } } },
        data: { status: 'REFUNDED' },
      });
      if (updated.count === 0) throw new UserFacingError('Tidak ada dana yang perlu dikembalikan untuk order ini.');
      await logAudit(tx, { actorId: user.id, action: 'payment.refund', entity: 'Order', entityId: orderId });
    });
  } catch (error) {
    return failFrom(error, 'Status refund belum bisa disimpan.');
  }

  revalidateOrders(orderId);
  return ok('Dana ditandai sudah dikembalikan.');
}
