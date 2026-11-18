import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createCategoryAction, deleteCategoryAction } from '@/actions/product.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { TextField } from '@/components/ui/Field';
import { formatRupiah } from '@/lib/format';
import { can } from '@/lib/permissions';
import { resolvePrice } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Produk' };

export default async function DashboardProductsPage() {
  const user = await requirePagePermission('product.manage');
  const seesCost = can(user.role, 'cost.view');
  const deletes = can(user.role, 'product.delete');

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        _count: { select: { images: true } },
        discounts: { where: { isActive: true } },
        variants: { select: { stock: true, isActive: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Produk"
        description="Atur model sepatu yang dijual, varian ukuran dan warna, serta foto studio. Harga diatur dari menu Harga & diskon."
        actions={
          <ButtonLink href="/dashboard/products/new" variant="primary" size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Tambah produk
          </ButtonLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_19rem]">
        <section>
          {products.length === 0 ? (
            <EmptyState title="Belum ada produk." hint="Tambah produk pertama, lalu isi ukuran dan stoknya." />
          ) : (
            <DataTable
              caption="Daftar produk"
              columns={[
                { key: 'product', label: 'Produk' },
                { key: 'category', label: 'Kategori' },
                { key: 'price', label: 'Harga', numeric: true },
                ...(seesCost ? [{ key: 'cost', label: 'Modal', numeric: true }] : []),
                { key: 'stock', label: 'Stok', numeric: true },
                { key: 'status', label: 'Status' },
              ]}
              rows={products.map((product) => {
                const price = resolvePrice(product.basePrice, product.discounts);
                const stock = product.variants.reduce((sum, v) => sum + (v.isActive ? v.stock : 0), 0);
                const thumb = product.images[0]?.url;
                return {
                  id: product.id,
                  sort: {
                    product: product.name,
                    category: product.category?.name ?? '',
                    price: price.finalPrice,
                    ...(seesCost ? { cost: product.costPrice } : {}),
                    stock,
                    status: product.isPublished ? 'Tayang' : 'Draf',
                  },
                  cells: {
                    product: (
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-studio-line bg-studio-card">
                          {thumb ? (
                            <Image src={thumb} alt="" fill sizes="44px" unoptimized className="object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] text-ink-muted">Foto</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/products/${product.id}`} className="font-medium text-ink hover:underline">
                            {product.name}
                          </Link>
                          <p className="text-xs text-ink-muted">
                            {product.brand}, {product._count.images} foto
                          </p>
                        </div>
                      </div>
                    ),
                    category: product.category ? <Badge>{product.category.name}</Badge> : <span className="text-xs text-ink-muted">Tanpa kategori</span>,
                    price: (
                      <>
                        {formatRupiah(price.finalPrice)}
                        {price.discountAmount > 0 && <p className="text-xs text-ink-muted line-through">{formatRupiah(price.basePrice)}</p>}
                      </>
                    ),
                    cost:
                      product.costPrice > 0 ? (
                        <>
                          {formatRupiah(product.costPrice)}
                          <p className="text-xs text-ink-muted">untung {Math.round(((price.finalPrice - product.costPrice) / price.finalPrice) * 100)}%</p>
                        </>
                      ) : (
                        <Badge tone="warn">Belum diisi</Badge>
                      ),
                    stock: (
                      <>
                        <span className={stock === 0 ? 'text-danger' : undefined}>{stock}</span>
                        <p className="text-xs text-ink-muted">{product.variants.length} varian</p>
                      </>
                    ),
                    status: product.isPublished ? <Badge tone="good">Tayang</Badge> : <Badge>Draf</Badge>,
                  },
                };
              })}
            />
          )}
        </section>

        <aside className="h-fit">
          <Panel title="Kategori" description="Kegunaan sepatu untuk filter di toko.">
          <ul className="divide-y divide-studio-line">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-medium text-ink">
                  {category.name}{' '}
                  <Badge>{category._count.products}</Badge>
                </span>
                {deletes && (
                  <ActionForm
                    action={deleteCategoryAction.bind(null, category.id)}
                    confirmTone="danger" confirmLabel="Ya, hapus" confirmMessage={`Hapus kategori “${category.name}”? Produknya tetap ada, hanya jadi tanpa kategori.`}
                  >
                    <SubmitButton variant="ghost" size="sm">
                      Hapus
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
            {categories.length === 0 && <li className="py-3 text-sm text-ink-muted">Belum ada kategori.</li>}
          </ul>
          <ActionForm action={createCategoryAction} resetOnSuccess className="mt-4 space-y-3 border-t border-studio-line pt-4">
            <TextField label="Kategori baru" name="name" placeholder="Misal: Basket" required />
            <SubmitButton variant="secondary" size="sm" className="w-full">
              Tambah kategori
            </SubmitButton>
          </ActionForm>
          </Panel>
        </aside>
      </div>
    </>
  );
}
