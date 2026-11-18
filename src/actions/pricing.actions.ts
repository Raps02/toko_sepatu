'use server';

import { revalidatePath } from 'next/cache';
import { fail, failFrom, ok, parseForm } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { applyChange, submitChangeRequest } from '@/lib/change-requests';
import { formatRupiah } from '@/lib/format';
import { can } from '@/lib/permissions';
import { discountAmountFor } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, requirePermission } from '@/lib/session';
import { discountSchema, priceChangeSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

function revalidatePricing(paths: string[] = []) {
  revalidatePath('/dashboard', 'layout');
  for (const path of paths) revalidatePath(path);
}

/** Ubah harga: admin langsung berlaku, SPV menjadi pengajuan yang menunggu admin. */
export async function changePriceAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requireAnyPermission(['price.apply', 'price.request']);
  if (denied) return denied;

  const { data, invalid } = parseForm(priceChangeSchema, formData);
  if (invalid) return invalid;

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) return fail('Produk tidak ditemukan.');
  if (product.basePrice === data.newPrice) {
    return fail(`Harga ${product.name} sudah ${formatRupiah(product.basePrice)}. Isi harga yang berbeda.`);
  }

  const payload = { productId: product.id, oldPrice: product.basePrice, newPrice: data.newPrice };
  const summary = `Harga ${product.name}: ${formatRupiah(product.basePrice)} → ${formatRupiah(data.newPrice)}`;

  try {
    if (can(user.role, 'price.apply')) {
      const paths = await prisma.$transaction((tx) => applyChange(tx, 'PRICE_CHANGE', payload, user.id, data.reason));
      revalidatePricing(paths);
      return ok(`Harga ${product.name} sekarang ${formatRupiah(data.newPrice)}.`);
    }

    await prisma.$transaction((tx) =>
      submitChangeRequest(tx, { type: 'PRICE_CHANGE', summary, payload, reason: data.reason, requestedById: user.id }),
    );
    revalidatePricing();
    return ok('Perubahan harga diajukan. Harga di toko berubah setelah admin menyetujuinya.');
  } catch (error) {
    return failFrom(error, 'Perubahan harga belum bisa disimpan.');
  }
}

/** Pasang diskon: admin langsung berlaku, SPV menjadi pengajuan yang menunggu admin. */
export async function createDiscountAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requireAnyPermission(['discount.apply', 'discount.request']);
  if (denied) return denied;

  const { data, invalid } = parseForm(discountSchema, formData);
  if (invalid) return invalid;

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) return fail('Produk tidak ditemukan.');
  if (data.type === 'FIXED' && data.value >= product.basePrice) {
    return {
      success: false,
      message: `Potongan harus lebih kecil dari harga ${product.name} (${formatRupiah(product.basePrice)}).`,
      error: { value: ['Potongan melebihi harga produk'] },
    };
  }

  const payload = {
    productId: product.id,
    type: data.type,
    value: data.value,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
  };
  const cut = discountAmountFor(product.basePrice, data);
  const label = data.type === 'PERCENT' ? `${data.value}%` : formatRupiah(data.value);
  const period = data.endsAt ? `${data.startsAt} s.d. ${data.endsAt}` : `mulai ${data.startsAt}`;
  const summary = `Diskon ${label} untuk ${product.name} (jadi ${formatRupiah(product.basePrice - cut)}), ${period}`;

  try {
    if (can(user.role, 'discount.apply')) {
      const paths = await prisma.$transaction((tx) => applyChange(tx, 'DISCOUNT', payload, user.id, data.reason));
      revalidatePricing(paths);
      return ok(`Diskon ${label} untuk ${product.name} sudah dipasang.`);
    }

    await prisma.$transaction((tx) =>
      submitChangeRequest(tx, { type: 'DISCOUNT', summary, payload, reason: data.reason, requestedById: user.id }),
    );
    revalidatePricing();
    return ok('Diskon diajukan. Diskon aktif setelah admin menyetujuinya.');
  } catch (error) {
    return failFrom(error, 'Diskon belum bisa disimpan.');
  }
}

/** Mengakhiri diskon lebih awal menaikkan harga jual, jadi hanya admin. */
export async function endDiscountAction(discountId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('discount.apply');
  if (denied) return denied;

  const discount = await prisma.discount.findUnique({
    where: { id: discountId },
    include: { product: { select: { slug: true, name: true } } },
  });
  if (!discount || !discount.isActive) return fail('Diskon ini sudah tidak aktif.');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.discount.update({ where: { id: discountId }, data: { isActive: false } });
      await logAudit(tx, {
        actorId: user.id,
        action: 'discount.end',
        entity: 'Product',
        entityId: discount.productId,
        before: { discountId, type: discount.type, value: discount.value },
      });
    });
  } catch (error) {
    return failFrom(error, 'Diskon belum bisa diakhiri.');
  }

  revalidatePricing(['/', '/products', `/products/${discount.product.slug}`]);
  return ok(`Diskon ${discount.product.name} diakhiri.`);
}
