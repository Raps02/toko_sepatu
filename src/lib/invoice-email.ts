import { appUrl } from '@/lib/auth-tokens';
import { invoiceEmail, sendEmail, type EmailResult } from '@/lib/email';
import { formatRupiah } from '@/lib/format';
import { hasInvoice, invoiceNumber, renderInvoicePdf } from '@/lib/invoice';
import { prisma } from '@/lib/prisma';

// Invoice PDF: dibuat untuk tombol unduh/lihat dan dikirim ke email pembeli setelah dibayar.

export type InvoiceFile = { filename: string; pdf: Uint8Array; orderNumber: string; total: number; customer: { name: string; email: string } };

/**
 * Invoice untuk pesanan yang sudah dibayar. Dengan `userId`, hanya pesanan milik user itu
 * (untuk aksi pembeli). Mengembalikan null kalau pesanan tidak ada atau belum dibayar.
 */
export async function buildInvoice(orderId: string, userId?: string): Promise<InvoiceFile | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...(userId ? { userId } : {}) },
    include: { items: true, payment: { select: { method: true } }, user: { select: { name: true, email: true } } },
  });
  if (!order || !hasInvoice(order.status)) return null;

  const pdf = await renderInvoicePdf({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    paymentMethod: order.payment?.method ?? null,
    customer: { name: order.user.name, email: order.user.email },
    shipTo: {
      recipient: order.shipRecipient,
      phone: order.shipPhone,
      street: order.shipStreet,
      city: order.shipCity,
      province: order.shipProvince,
      postalCode: order.shipPostalCode,
    },
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    items: order.items,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingCost: order.shippingCost,
    total: order.total,
  });
  return {
    filename: `${invoiceNumber(order.orderNumber)}.pdf`,
    pdf,
    orderNumber: order.orderNumber,
    total: order.total,
    customer: order.user,
  };
}

/** Jeda minimal antar kirim ulang invoice untuk pesanan yang sama. */
export const INVOICE_RESEND_SECONDS = 60;

export type InvoiceEmailOutcome = EmailResult | { sent: false; reason: 'not-found' | 'already-sent' | 'cooldown' };

/**
 * Kirim invoice ke email pembeli.
 * - `auto` (saat pesanan baru dibayar): hanya sekali per pesanan, walaupun notifikasi Midtrans datang berulang.
 * - `resend` (tombol pembeli): boleh lagi, dengan jeda INVOICE_RESEND_SECONDS.
 * Tidak pernah melempar error, supaya kegagalan email tidak mengganggu pembayaran.
 */
export async function sendInvoiceEmail(orderId: string, mode: 'auto' | 'resend' = 'auto', userId?: string): Promise<InvoiceEmailOutcome> {
  try {
    const now = new Date();
    // Klaim dulu secara atomik supaya dua proses tidak mengirim bersamaan.
    const claimed = await prisma.order.updateMany({
      where: {
        id: orderId,
        ...(userId ? { userId } : {}),
        ...(mode === 'auto'
          ? { invoiceEmailedAt: null }
          : { OR: [{ invoiceEmailedAt: null }, { invoiceEmailedAt: { lt: new Date(now.getTime() - INVOICE_RESEND_SECONDS * 1000) } }] }),
      },
      data: { invoiceEmailedAt: now },
    });
    if (claimed.count === 0) {
      const exists = await prisma.order.count({ where: { id: orderId, ...(userId ? { userId } : {}) } });
      if (!exists) return { sent: false, reason: 'not-found' };
      return { sent: false, reason: mode === 'auto' ? 'already-sent' : 'cooldown' };
    }

    const invoice = await buildInvoice(orderId, userId);
    if (!invoice) {
      await prisma.order.update({ where: { id: orderId }, data: { invoiceEmailedAt: null } });
      return { sent: false, reason: 'not-found' };
    }

    const mail = invoiceEmail({
      name: invoice.customer.name,
      orderNumber: invoice.orderNumber,
      invoiceNumber: invoiceNumber(invoice.orderNumber),
      total: formatRupiah(invoice.total),
      orderUrl: `${appUrl()}/orders/${orderId}`,
    });
    const result = await sendEmail({
      to: invoice.customer,
      ...mail,
      attachments: [{ name: invoice.filename, content: Buffer.from(invoice.pdf).toString('base64') }],
    });
    // Belum terkirim (email belum disetel atau Brevo menolak): klaim dilepas supaya bisa dicoba lagi.
    if (!result.sent) await prisma.order.update({ where: { id: orderId }, data: { invoiceEmailedAt: null } });
    return result;
  } catch (error) {
    console.error('[email] Gagal mengirim invoice untuk order', orderId, error instanceof Error ? error.message : error);
    await prisma.order.update({ where: { id: orderId }, data: { invoiceEmailedAt: null } }).catch(() => {});
    return { sent: false, reason: 'failed' };
  }
}
