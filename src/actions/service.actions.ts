'use server';

// Layanan setelah pembelian: review, retur, dan chat produk.

import { revalidatePath } from 'next/cache';
import { fail, failFrom, isUniqueViolation, ok, parseForm, UserFacingError } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { postCustomerMessage } from '@/lib/chat';
import { lineTotal } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requirePermission } from '@/lib/session';
import { changeStock } from '@/lib/stock';
import { handleReturnSchema, messageSchema, returnRequestSchema, reviewReplySchema, reviewSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

/** Batas waktu mengajukan retur sejak pesanan selesai. */
const RETURN_WINDOW_DAYS = 7;

// ───────────────────────── Review ─────────────────────────

export async function createReviewAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('review.write');
  if (denied) return denied;

  const { data, invalid } = parseForm(reviewSchema, formData);
  if (invalid) return invalid;

  // Hanya barang milik sendiri dari order yang sudah selesai yang bisa direview.
  const item = await prisma.orderItem.findFirst({
    where: { id: data.orderItemId, order: { userId: user.id, status: 'COMPLETED' } },
    include: { variant: { select: { product: { select: { slug: true } } } } },
  });
  if (!item) return fail('Review hanya bisa ditulis untuk sepatu dari pesanan yang sudah kamu terima.');

  try {
    await prisma.review.create({
      data: {
        orderItemId: item.id,
        userId: user.id,
        productId: item.productId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail('Kamu sudah mereview sepatu ini dari pesanan tersebut.');
    return failFrom(error, 'Review belum bisa disimpan.');
  }

  revalidatePath(`/orders/${item.orderId}`);
  revalidatePath(`/products/${item.variant.product.slug}`);
  revalidatePath('/dashboard', 'layout');
  return ok('Terima kasih, review kamu sudah tayang.');
}

export async function replyReviewAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('review.reply');
  if (denied) return denied;

  const { data, invalid } = parseForm(reviewReplySchema, formData);
  if (invalid) return invalid;

  try {
    const review = await prisma.review.update({
      where: { id: data.reviewId },
      data: { reply: data.reply, repliedById: user.id, repliedAt: new Date() },
      include: { product: { select: { slug: true } } },
    });
    revalidatePath(`/products/${review.product.slug}`);
  } catch (error) {
    return failFrom(error, 'Balasan belum bisa disimpan.');
  }

  revalidatePath('/dashboard', 'layout');
  return ok('Balasan tayang di halaman produk.');
}

export async function setReviewHiddenAction(reviewId: string, isHidden: boolean): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('review.moderate');
  if (denied) return denied;

  try {
    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { isHidden },
        include: { product: { select: { slug: true } } },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: isHidden ? 'review.hide' : 'review.unhide',
        entity: 'Review',
        entityId: reviewId,
        after: { rating: updated.rating, comment: updated.comment },
      });
      return updated;
    });
    revalidatePath(`/products/${review.product.slug}`);
  } catch (error) {
    return failFrom(error, 'Status review belum bisa diubah.');
  }

  revalidatePath('/dashboard', 'layout');
  return ok();
}

// ───────────────────────── Retur ─────────────────────────

export async function requestReturnAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('return.request');
  if (denied) return denied;

  const { data, invalid } = parseForm(returnRequestSchema, formData);
  if (invalid) return invalid;

  const item = await prisma.orderItem.findFirst({
    where: { id: data.orderItemId, order: { userId: user.id } },
    include: { order: true, returnRequests: { where: { status: { not: 'REJECTED' } } } },
  });
  if (!item) return fail('Barang tidak ditemukan di pesananmu.');

  // Retur dibuka setelah pembeli mengonfirmasi pesanan diterima (status COMPLETED).
  if (item.order.status !== 'COMPLETED') {
    return fail('Retur bisa diajukan setelah kamu mengonfirmasi pesanan sudah diterima.');
  }
  if (item.order.completedAt) {
    const deadline = item.order.completedAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > deadline) return fail(`Batas pengajuan retur adalah ${RETURN_WINDOW_DAYS} hari setelah pesanan diterima.`);
  }

  const alreadyRequested = item.returnRequests.reduce((sum, r) => sum + r.quantity, 0);
  const returnable = item.quantity - alreadyRequested;
  if (returnable <= 0) return fail('Semua pasang dari barang ini sudah diajukan retur.');
  if (data.quantity > returnable) return fail(`Kamu bisa mengajukan retur maksimal ${returnable} pasang untuk barang ini.`);

  try {
    await prisma.returnRequest.create({
      data: { orderItemId: item.id, userId: user.id, quantity: data.quantity, reason: data.reason },
    });
  } catch (error) {
    return failFrom(error, 'Pengajuan retur belum bisa dikirim.');
  }

  revalidatePath(`/orders/${item.orderId}`);
  revalidatePath('/dashboard', 'layout');
  return ok('Pengajuan retur terkirim. Toko akan memeriksanya dan mengabari lewat halaman ini.');
}

const RETURN_STEP = {
  APPROVED: { from: 'REQUESTED', action: 'return.approve', message: 'Retur disetujui. Pembeli diminta mengirim barangnya kembali.' },
  REJECTED: { from: 'REQUESTED', action: 'return.reject', message: 'Retur ditolak.' },
  RECEIVED: { from: 'APPROVED', action: 'return.receive', message: 'Barang diterima dan stoknya dikembalikan.' },
  REFUNDED: { from: 'RECEIVED', action: 'return.refund', message: 'Retur ditandai sudah direfund.' },
} as const;

/**
 * Alur retur: diajukan → disetujui/ditolak → barang diterima (stok kembali)
 * → direfund. Tiap langkah hanya bisa dari langkah sebelumnya.
 */
export async function handleReturnAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('return.handle');
  if (denied) return denied;

  const { data, invalid } = parseForm(handleReturnSchema, formData);
  if (invalid) return invalid;

  const step = RETURN_STEP[data.decision];
  if (data.decision === 'REFUNDED' && !can(user.role, 'return.refund')) {
    return fail('Hanya admin yang bisa menandai dana retur sudah dikembalikan.');
  }
  if (data.decision === 'REJECTED' && !data.handlerNote) {
    return {
      success: false,
      message: 'Tulis alasan penolakan supaya pembeli tahu kenapa returnya ditolak.',
      error: { handlerNote: ['Alasan wajib diisi saat menolak'] },
    };
  }

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const existing = await tx.returnRequest.findUnique({ where: { id: data.returnId }, include: { orderItem: true } });
      if (!existing) throw new UserFacingError('Pengajuan retur tidak ditemukan.');

      // Nilai refund ditetapkan saat barang diterima: harga yang benar-benar dibayar per pasang.
      const refundAmount =
        data.decision === 'RECEIVED'
          ? lineTotal({ ...existing.orderItem, quantity: existing.quantity })
          : existing.refundAmount;

      const claimed = await tx.returnRequest.updateMany({
        where: { id: existing.id, status: step.from },
        data: {
          status: data.decision,
          handledById: user.id,
          handlerNote: data.handlerNote ?? existing.handlerNote,
          refundAmount,
          ...(data.decision === 'REFUNDED' && { refundedAt: new Date() }),
        },
      });
      if (claimed.count === 0) throw new UserFacingError('Status retur ini sudah berubah. Muat ulang halaman.');

      if (data.decision === 'RECEIVED') {
        await changeStock(tx, {
          variantId: existing.orderItem.variantId,
          delta: existing.quantity,
          type: 'RESTOCK',
          orderId: existing.orderItem.orderId,
          actorId: user.id,
          note: 'Barang retur diterima',
        });
      }

      await logAudit(tx, {
        actorId: user.id,
        action: step.action,
        entity: 'ReturnRequest',
        entityId: existing.id,
        after: { quantity: existing.quantity, refundAmount, note: data.handlerNote ?? null },
      });
      return existing.orderItem.orderId;
    });

    revalidatePath(`/orders/${orderId}`);
  } catch (error) {
    return failFrom(error, 'Status retur belum bisa disimpan.');
  }

  revalidatePath('/dashboard', 'layout');
  return ok(step.message);
}

// ───────────────────────── Chat produk ─────────────────────────

/** Kirim pesan. Customer hanya di percakapannya sendiri; staf di percakapan mana pun. */
export async function sendMessageAction(conversationId: string, formData: FormData): Promise<ActionResponse> {
  const user = await getCurrentUser();
  if (!user) return fail('Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.');

  const isStaff = can(user.role, 'chat.reply');
  if (!isStaff && !can(user.role, 'chat.start')) return fail('Akun kamu tidak punya izin untuk tindakan ini.');

  const { data, invalid } = parseForm(messageSchema, formData);
  if (invalid) return invalid;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...(isStaff ? {} : { customerId: user.id }) },
    select: { id: true },
  });
  if (!conversation) return fail('Percakapan tidak ditemukan.');

  try {
    if (isStaff) {
      // Staf mengambil alih: bot berhenti dan percakapan tidak lagi menunggu staf.
      await prisma.$transaction([
        prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: data.body } }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), botEnabled: false, needsStaff: false },
        }),
      ]);
    } else {
      await postCustomerMessage({ conversationId: conversation.id, customer: { id: user.id, name: user.name }, body: data.body });
    }
  } catch (error) {
    return failFrom(error, 'Pesan belum terkirim. Coba kirim lagi.');
  }

  revalidatePath(`/chat/${conversation.id}`);
  revalidatePath(`/dashboard/chat/${conversation.id}`);
  revalidatePath('/dashboard', 'layout');
  return ok();
}
