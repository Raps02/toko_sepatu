'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, failFrom, isUniqueViolation, ok, parseForm } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/session';
import { deleteImage, saveImage } from '@/lib/storage';
import { categorySchema, createProductSchema, updateProductSchema, variantSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

const MAX_IMAGES_PER_PRODUCT = 6;

function revalidateCatalog(slug?: string) {
  revalidatePath('/dashboard/products', 'layout');
  revalidatePath('/');
  revalidatePath('/products');
  if (slug) revalidatePath(`/products/${slug}`);
}

async function uniqueProductSlug(name: string): Promise<string> {
  const base = slugify(name) || 'produk';
  if (!(await prisma.product.findUnique({ where: { slug: base }, select: { id: true } }))) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Gagal dengan pesan di bawah satu isian, seperti hasil validasi Zod. */
function fieldFail(field: string, message: string): ActionResponse {
  return { success: false, message: 'Ada isian yang belum benar. Periksa lagi bagian yang ditandai.', error: { [field]: [message] } };
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2003';
}

// ── Kategori ──

export async function createCategoryAction(formData: FormData): Promise<ActionResponse> {
  const { denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(categorySchema, formData);
  if (invalid) return invalid;

  try {
    await prisma.category.create({ data: { name: data.name, slug: slugify(data.name) } });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(`Kategori “${data.name}” sudah ada.`);
    return failFrom(error, 'Kategori belum bisa disimpan.');
  }

  revalidateCatalog();
  return ok();
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResponse> {
  const { denied } = await requirePermission('product.delete');
  if (denied) return denied;

  try {
    // Produk di kategori ini tidak ikut terhapus; kategorinya saja yang dikosongkan.
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    return failFrom(error, 'Kategori belum bisa dihapus.');
  }

  revalidateCatalog();
  return ok();
}

// ── Produk ──

export async function createProductAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(createProductSchema, formData);
  if (invalid) return invalid;

  // Admin wajib mengisi modal. Produk dari SPV selalu masuk sebagai draf tanpa
  // modal; admin melengkapi modal lalu menayangkannya dari halaman produk.
  const seesCost = can(user.role, 'cost.view');
  if (seesCost && data.costPrice === undefined) return fieldFail('costPrice', 'Harga modal per pasang wajib diisi');
  const costPrice = seesCost ? data.costPrice! : 0;
  const isPublished = can(user.role, 'product.publish') ? data.isPublished : false;

  let productId: string;
  try {
    const slug = await uniqueProductSlug(data.name);
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: data.name,
          slug,
          brand: data.brand,
          description: data.description ?? null,
          basePrice: data.basePrice,
          costPrice,
          gender: data.gender,
          categoryId: data.categoryId ?? null,
          isPublished,
        },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: 'product.create',
        entity: 'Product',
        entityId: created.id,
        after: {
          name: created.name,
          basePrice: created.basePrice,
          costPrice: created.costPrice,
          gender: created.gender,
          isPublished: created.isPublished,
        },
      });
      return created;
    });
    productId = product.id;
  } catch (error) {
    return failFrom(error, 'Produk belum bisa disimpan.');
  }

  revalidateCatalog();
  // Lanjut ke halaman produk untuk menambah ukuran dan foto.
  redirect(`/dashboard/products/${productId}`);
}

export async function updateProductAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(updateProductSchema, formData);
  if (invalid) return invalid;

  const before = await prisma.product.findUnique({ where: { id: data.id } });
  if (!before) return fail('Produk tidak ditemukan. Mungkin sudah dihapus.');

  // SPV tidak bisa mengubah status tayang maupun modal, walau isiannya dikirim manual.
  const seesCost = can(user.role, 'cost.view');
  if (seesCost && data.costPrice === undefined) return fieldFail('costPrice', 'Harga modal per pasang wajib diisi');
  const costPrice = seesCost ? data.costPrice! : before.costPrice;
  const isPublished = can(user.role, 'product.publish') ? data.isPublished : before.isPublished;
  if (isPublished && costPrice === 0) {
    return fieldFail('costPrice', 'Isi harga modal dulu sebelum produk ditayangkan, supaya laba kotornya benar.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const after = await tx.product.update({
        where: { id: data.id },
        data: {
          name: data.name,
          brand: data.brand,
          description: data.description ?? null,
          gender: data.gender,
          categoryId: data.categoryId ?? null,
          isPublished,
          costPrice,
        },
      });
      // Modal varian ikut produk; order berikutnya memakai modal baru ini.
      if (costPrice !== before.costPrice) {
        await tx.productVariant.updateMany({ where: { productId: after.id }, data: { avgCost: costPrice } });
      }
      await logAudit(tx, {
        actorId: user.id,
        action: 'product.update',
        entity: 'Product',
        entityId: after.id,
        before: { name: before.name, brand: before.brand, gender: before.gender, isPublished: before.isPublished, costPrice: before.costPrice },
        after: { name: after.name, brand: after.brand, gender: after.gender, isPublished: after.isPublished, costPrice: after.costPrice },
      });
    });
  } catch (error) {
    return failFrom(error, 'Perubahan produk belum bisa disimpan.');
  }

  revalidateCatalog(before.slug);
  return ok('Perubahan disimpan.');
}

export async function deleteProductAction(productId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.delete');
  if (denied) return denied;

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
  if (!product) return fail('Produk tidak ditemukan. Mungkin sudah dihapus.');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id: productId } });
      await logAudit(tx, {
        actorId: user.id,
        action: 'product.delete',
        entity: 'Product',
        entityId: productId,
        before: { name: product.name, basePrice: product.basePrice },
      });
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return fail('Produk ini sudah pernah dipesan, jadi tidak bisa dihapus. Sembunyikan dari toko dengan mematikan “Tayang di toko”.');
    }
    return failFrom(error, 'Produk belum bisa dihapus.');
  }

  await Promise.all(product.images.map((image) => deleteImage(image.url)));
  revalidateCatalog(product.slug);
  redirect('/dashboard/products');
}

// ── Varian (ukuran + warna) ──

export async function addVariantAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(variantSchema, formData);
  if (invalid) return invalid;

  const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { slug: true, costPrice: true } });
  if (!product) return fail('Produk tidak ditemukan.');

  const sku = (data.sku ?? `${product.slug}-${slugify(data.color)}-${slugify(data.size)}`).toUpperCase();

  try {
    await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: { productId: data.productId, size: data.size, color: data.color, sku, avgCost: product.costPrice },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: 'variant.create',
        entity: 'ProductVariant',
        entityId: variant.id,
        after: { sku, size: data.size, color: data.color },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail(`Ukuran ${data.size} warna ${data.color} sudah ada, atau SKU ${sku} sudah dipakai produk lain.`);
    }
    return failFrom(error, 'Varian belum bisa ditambahkan.');
  }

  revalidateCatalog(product.slug);
  return ok();
}

export async function setVariantActiveAction(variantId: string, isActive: boolean): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive },
        include: { product: { select: { slug: true } } },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: isActive ? 'variant.activate' : 'variant.deactivate',
        entity: 'ProductVariant',
        entityId: variantId,
        after: { sku: updated.sku, isActive },
      });
      return updated;
    });
    revalidateCatalog(variant.product.slug);
  } catch (error) {
    return failFrom(error, 'Status varian belum bisa diubah.');
  }
  return ok();
}

export async function deleteVariantAction(variantId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.delete');
  if (denied) return denied;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { slug: true } } },
  });
  if (!variant) return fail('Varian tidak ditemukan.');
  if (variant.stock > 0) {
    return fail(`Masih ada ${variant.stock} pasang di stok. Catat barang keluar dulu, atau nonaktifkan variannya saja.`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.delete({ where: { id: variantId } });
      await logAudit(tx, {
        actorId: user.id,
        action: 'variant.delete',
        entity: 'ProductVariant',
        entityId: variantId,
        before: { sku: variant.sku },
      });
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return fail('Varian ini sudah pernah dipesan, jadi tidak bisa dihapus. Nonaktifkan saja supaya tidak tampil di toko.');
    }
    return failFrom(error, 'Varian belum bisa dihapus.');
  }

  revalidateCatalog(variant.product.slug);
  return ok();
}

// ── Foto ──

export async function uploadProductImageAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const productId = formData.get('productId');
  const file = formData.get('image');
  if (typeof productId !== 'string' || !(file instanceof File)) return fail('Pilih file gambar dulu.');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, _count: { select: { images: true } } },
  });
  if (!product) return fail('Produk tidak ditemukan.');
  if (product._count.images >= MAX_IMAGES_PER_PRODUCT) {
    return fail(`Satu produk maksimal ${MAX_IMAGES_PER_PRODUCT} foto. Hapus salah satu dulu.`);
  }

  try {
    const url = await saveImage(file);
    await prisma.productImage.create({ data: { productId, url, sortOrder: product._count.images } });
    await logAudit(prisma, { actorId: user.id, action: 'product.image.add', entity: 'Product', entityId: productId });
  } catch (error) {
    return failFrom(error, 'Foto belum bisa diunggah.');
  }

  revalidateCatalog(product.slug);
  return ok();
}

export async function deleteProductImageAction(imageId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('product.manage');
  if (denied) return denied;

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: { select: { slug: true } } },
  });
  if (!image) return fail('Foto tidak ditemukan.');

  try {
    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteImage(image.url);
    await logAudit(prisma, { actorId: user.id, action: 'product.image.delete', entity: 'Product', entityId: image.productId });
  } catch (error) {
    return failFrom(error, 'Foto belum bisa dihapus.');
  }

  revalidateCatalog(image.product.slug);
  return ok();
}
