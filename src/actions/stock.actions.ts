'use server';

import { revalidatePath } from 'next/cache';
import { fail, failFrom, ok, parseForm } from '@/lib/action-helpers';
import { applyChange, submitChangeRequest } from '@/lib/change-requests';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, requirePermission } from '@/lib/session';
import { changeStock } from '@/lib/stock';
import { stockCorrectionSchema, stockInSchema, stockOutSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

function revalidateStock() {
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/');
  revalidatePath('/products', 'layout');
}

export async function stockInAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('stock.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(stockInSchema, formData);
  if (invalid) return invalid;

  try {
    const result = await prisma.$transaction((tx) =>
      changeStock(tx, {
        variantId: data.variantId,
        delta: data.quantity,
        type: 'IN',
        note: data.note,
        actorId: user.id,
      }),
    );
    revalidateStock();
    return ok(`Barang masuk dicatat. Stok sekarang ${result.stockAfter} pasang.`);
  } catch (error) {
    return failFrom(error, 'Barang masuk belum bisa dicatat.');
  }
}

export async function stockOutAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('stock.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(stockOutSchema, formData);
  if (invalid) return invalid;

  try {
    const result = await prisma.$transaction((tx) =>
      changeStock(tx, {
        variantId: data.variantId,
        delta: -data.quantity,
        type: 'OUT',
        note: data.note,
        actorId: user.id,
      }),
    );
    revalidateStock();
    return ok(`Barang keluar dicatat. Stok sekarang ${result.stockAfter} pasang.`);
  } catch (error) {
    return failFrom(error, 'Barang keluar belum bisa dicatat.');
  }
}

/** Koreksi stok: admin langsung berlaku, SPV menjadi pengajuan yang menunggu admin. */
export async function stockCorrectionAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requireAnyPermission(['stock.correct.apply', 'stock.correct.request']);
  if (denied) return denied;

  const { data, invalid } = parseForm(stockCorrectionSchema, formData);
  if (invalid) return invalid;

  const variant = await prisma.productVariant.findUnique({
    where: { id: data.variantId },
    include: { product: { select: { name: true } } },
  });
  if (!variant) return fail('Varian tidak ditemukan. Mungkin sudah dihapus.');
  if (variant.stock === data.actualStock) {
    return fail(`Stok tercatat sudah ${variant.stock} pasang, sama dengan hasil hitungmu. Tidak ada yang perlu dikoreksi.`);
  }

  const payload = { variantId: variant.id, recordedStock: variant.stock, actualStock: data.actualStock };
  const summary = `Stok ${variant.product.name} ${variant.color} uk. ${variant.size}: ${variant.stock} → ${data.actualStock} pasang`;

  try {
    if (can(user.role, 'stock.correct.apply')) {
      await prisma.$transaction((tx) => applyChange(tx, 'STOCK_CORRECTION', payload, user.id, data.reason));
      revalidateStock();
      return ok(`Stok dikoreksi menjadi ${data.actualStock} pasang.`);
    }

    await prisma.$transaction((tx) =>
      submitChangeRequest(tx, { type: 'STOCK_CORRECTION', summary, payload, reason: data.reason, requestedById: user.id }),
    );
    revalidateStock();
    return ok('Koreksi diajukan. Stok berubah setelah admin menyetujuinya.');
  } catch (error) {
    return failFrom(error, 'Koreksi stok belum bisa disimpan.');
  }
}
