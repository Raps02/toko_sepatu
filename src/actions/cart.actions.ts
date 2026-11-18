'use server';

import { revalidatePath } from 'next/cache';
import { fail, failFrom, ok, parseForm } from '@/lib/action-helpers';
import { MAX_PAIRS_PER_ITEM } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/session';
import { addToCartSchema, changeCartVariantSchema, updateCartSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

const MAX_PER_ITEM = MAX_PAIRS_PER_ITEM;

function revalidateCart() {
  // Layout ikut di-revalidate karena jumlah keranjang tampil di header.
  revalidatePath('/', 'layout');
}

export async function addToCartAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(addToCartSchema, formData);
  if (invalid) return invalid;

  const variant = await prisma.productVariant.findUnique({
    where: { id: data.variantId },
    include: { product: { select: { name: true, isPublished: true } } },
  });
  if (!variant || !variant.isActive || !variant.product.isPublished) {
    return fail('Sepatu ini sudah tidak dijual. Muat ulang halaman untuk melihat pilihan terbaru.');
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId: user.id, variantId: variant.id } },
  });
  const wanted = (existing?.quantity ?? 0) + data.quantity;

  if (wanted > variant.stock) {
    return fail(
      existing
        ? `Stok ukuran ${variant.size} tinggal ${variant.stock} pasang dan ${existing.quantity} sudah ada di keranjangmu.`
        : `Stok ukuran ${variant.size} tinggal ${variant.stock} pasang.`,
    );
  }
  if (wanted > MAX_PER_ITEM) return fail(`Maksimal ${MAX_PER_ITEM} pasang untuk satu ukuran dalam satu pesanan.`);

  try {
    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId: user.id, variantId: variant.id } },
      update: { quantity: wanted },
      create: { userId: user.id, variantId: variant.id, quantity: data.quantity },
    });
  } catch (error) {
    return failFrom(error, 'Belum bisa menambahkan ke keranjang.');
  }

  revalidateCart();
  return ok(`${variant.product.name} ukuran ${variant.size} masuk keranjang.`);
}

export async function updateCartItemAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(updateCartSchema, formData);
  if (invalid) return invalid;

  // `userId` di where memastikan pembeli hanya bisa mengubah keranjangnya sendiri.
  const item = await prisma.cartItem.findFirst({
    where: { id: data.cartItemId, userId: user.id },
    include: { variant: { select: { stock: true, size: true } } },
  });
  if (!item) return fail('Barang ini sudah tidak ada di keranjang.');

  if (data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    if (data.quantity > item.variant.stock) {
      return fail(`Stok ukuran ${item.variant.size} tinggal ${item.variant.stock} pasang.`);
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: data.quantity } });
  }

  revalidateCart();
  return ok();
}

export async function removeCartItemAction(cartItemId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  await prisma.cartItem.deleteMany({ where: { id: cartItemId, userId: user.id } });
  revalidateCart();
  return ok();
}

/** Ganti warna/ukuran barang di keranjang. Kalau varian tujuan sudah ada di keranjang, keduanya digabung. */
export async function changeCartVariantAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(changeCartVariantSchema, formData);
  if (invalid) return invalid;

  const item = await prisma.cartItem.findFirst({
    where: { id: data.cartItemId, userId: user.id },
    include: { variant: { select: { productId: true } } },
  });
  if (!item) return fail('Barang ini sudah tidak ada di keranjang.');
  if (item.variantId === data.variantId) return ok();

  // Hanya boleh pindah ke varian lain dari produk yang sama.
  const target = await prisma.productVariant.findFirst({
    where: { id: data.variantId, productId: item.variant.productId, isActive: true, product: { isPublished: true } },
  });
  if (!target) return fail('Pilihan itu sudah tidak dijual. Muat ulang halaman untuk melihat pilihan terbaru.');

  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId: user.id, variantId: target.id } },
  });
  const wanted = item.quantity + (existing?.quantity ?? 0);
  const label = `ukuran ${target.size} warna ${target.color}`;
  if (wanted > target.stock) {
    return fail(
      existing
        ? `Stok ${label} tinggal ${target.stock} pasang dan ${existing.quantity} sudah ada di keranjangmu.`
        : `Stok ${label} tinggal ${target.stock} pasang. Kurangi jumlahnya dulu.`,
    );
  }
  if (wanted > MAX_PER_ITEM) return fail(`Maksimal ${MAX_PER_ITEM} pasang untuk satu ukuran dalam satu pesanan.`);

  try {
    if (existing) {
      await prisma.$transaction([
        prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: wanted } }),
        prisma.cartItem.delete({ where: { id: item.id } }),
      ]);
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { variantId: target.id } });
    }
  } catch (error) {
    return failFrom(error, 'Pilihan belum bisa diganti. Coba lagi.');
  }

  revalidateCart();
  return ok(existing ? `Digabung dengan ${label} yang sudah ada di keranjang.` : undefined);
}
