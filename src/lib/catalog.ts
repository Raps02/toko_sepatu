import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { type Gender, sortSizes } from '@/lib/sizes';

// Dipindah ke lib/sizes supaya bisa dipakai komponen client; tetap diekspor dari sini.
export { sortSizes };

export const productCardInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 6 },
  discounts: { where: { isActive: true } },
  variants: { where: { isActive: true }, select: { id: true, size: true, color: true, stock: true } },
} satisfies Prisma.ProductInclude;

export type ProductCardData = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

/** Deret ukuran sebuah produk: tiap ukuran sekali, dengan total stok dari semua warna. */
export function sizeRun(variants: { size: string; stock: number }[]): { size: string; stock: number }[] {
  const totals = new Map<string, number>();
  for (const v of variants) totals.set(v.size, (totals.get(v.size) ?? 0) + Math.max(v.stock, 0));
  return sortSizes([...totals.keys()]).map((size) => ({ size, stock: totals.get(size) ?? 0 }));
}

export const SORT_OPTIONS = {
  terbaru: { label: 'Terbaru', orderBy: { createdAt: 'desc' } },
  termurah: { label: 'Harga terendah', orderBy: { basePrice: 'asc' } },
  termahal: { label: 'Harga tertinggi', orderBy: { basePrice: 'desc' } },
  nama: { label: 'Nama A–Z', orderBy: { name: 'asc' } },
} as const satisfies Record<string, { label: string; orderBy: Prisma.ProductOrderByWithRelationInput }>;

export type SortKey = keyof typeof SORT_OPTIONS;

export type CatalogFilter = {
  q?: string;
  category?: string;
  size?: string;
  /** Pria atau Wanita; produk unisex ikut tampil di keduanya. */
  gender?: Gender;
  sort?: string;
  take?: number;
};

/** Kondisi produk tayang yang cocok dengan filter (tanpa urutan/batas). */
export function catalogWhere(filter: CatalogFilter = {}): Prisma.ProductWhereInput {
  const q = filter.q?.trim().slice(0, 80);
  return {
    isPublished: true,
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ],
    }),
    ...(filter.category && { category: { slug: filter.category } }),
    ...(filter.gender && { gender: { in: [filter.gender, 'UNISEX'] } }),
    ...(filter.size && { variants: { some: { isActive: true, size: filter.size, stock: { gt: 0 } } } }),
  };
}

export async function listProducts(filter: CatalogFilter = {}): Promise<ProductCardData[]> {
  const sort: SortKey = filter.sort && Object.hasOwn(SORT_OPTIONS, filter.sort) ? (filter.sort as SortKey) : 'terbaru';
  return prisma.product.findMany({
    where: catalogWhere(filter),
    include: productCardInclude,
    orderBy: SORT_OPTIONS[sort].orderBy,
    take: filter.take ?? 60,
  });
}

/**
 * Jumlah produk per kategori untuk filter yang sama, tanpa filter kategori itu sendiri,
 * supaya pembeli tahu isi tiap pilihan sebelum mengekliknya.
 */
export async function countByCategory(filter: CatalogFilter = {}): Promise<Map<string | null, number>> {
  const rows = await prisma.product.groupBy({
    by: ['categoryId'],
    where: catalogWhere({ ...filter, category: undefined }),
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.categoryId, row._count._all]));
}

/** Produk yang sedang didiskon (ada diskon aktif), untuk banner promo di halaman depan. */
export async function listDiscountedProducts(take = 8): Promise<ProductCardData[]> {
  return prisma.product.findMany({
    where: { isPublished: true, discounts: { some: { isActive: true } } },
    include: productCardInclude,
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

/** Ukuran yang saat ini punya stok di produk yang tayang (opsional: hanya untuk pria/wanita). */
export async function listAvailableSizes(gender?: Gender): Promise<string[]> {
  const rows = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      product: { isPublished: true, ...(gender && { gender: { in: [gender, 'UNISEX'] } }) },
    },
    distinct: ['size'],
    select: { size: true },
  });
  return sortSizes(rows.map((r) => r.size));
}
