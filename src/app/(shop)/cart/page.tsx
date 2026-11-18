import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/arc/alert/alert';
import { EmptyState } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { ProductImage } from '@/components/shop/ProductCard';
import { CartItemControls } from '@/components/shop/CartItemControls';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { formatRupiah } from '@/lib/format';
import { FREE_SHIPPING_MIN_PAIRS, MAX_PAIRS_PER_ITEM, resolvePrice, sumCart, totalPairs } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { imageForColor } from '@/lib/product-images';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Keranjang' };

export default async function CartPage() {
  const user = await requirePagePermission('shop.buy');

  const items = await prisma.cartItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          product: {
            include: {
              // Semua foto, supaya yang ditampilkan bisa mengikuti warna pilihan.
              images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
              discounts: { where: { isActive: true } },
              // Pilihan warna/ukuran lain di keranjang.
              variants: { where: { isActive: true }, select: { id: true, size: true, color: true, stock: true } },
            },
          },
        },
      },
    },
  });

  const lines = items.map((item) => {
    const { variant } = item;
    const price = resolvePrice(variant.product.basePrice, variant.product.discounts);
    const unavailable = !variant.isActive || !variant.product.isPublished;
    const problem = unavailable
      ? 'Sudah tidak dijual. Hapus dari keranjang.'
      : variant.stock === 0
        ? 'Stok habis. Hapus dari keranjang.'
        : item.quantity > variant.stock
          ? `Stok tinggal ${variant.stock} pasang. Kurangi jumlahnya.`
          : null;
    return { item, variant, price, problem };
  });

  const totals = sumCart(lines.map((l) => ({ unitPrice: l.price.basePrice, discountAmount: l.price.discountAmount, quantity: l.item.quantity })));
  const pairsLeft = Math.max(FREE_SHIPPING_MIN_PAIRS - totalPairs(lines.map((l) => l.item)), 0);
  const blocked = lines.some((l) => l.problem);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="sr-only">Keranjang belanja</h1>
        <EmptyState
          title="Keranjangmu Masih Kosong"
          hint="Pilih sepatu dan ukurannya terlebih dahulu, lalu masukkan ke keranjang."
          action={
            <ButtonLink href="/products" variant="primary" pill>
              Jelajahi Semua Sepatu
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Keranjang Belanja</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Panel title="Barang">
        <ul className={panelListClass}>
          {lines.map(({ item, variant, price, problem }) => (
            <li key={item.id} className="flex gap-4 px-5 py-5 sm:gap-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-studio-card sm:h-28 sm:w-28">
                <ProductImage
                  url={imageForColor(variant.product.images, variant.color)?.url}
                  label={variant.product.name}
                  alt={`${variant.product.name} warna ${variant.color}`}
                  sizes="112px"
                />
              </div>

              <div className="min-w-0 flex-1">
                <Link href={`/products/${variant.product.slug}`} className="text-base font-semibold text-ink hover:underline">
                  {variant.product.name}
                </Link>
                <p className="tabular mt-1 text-sm font-medium text-ink">
                  {formatRupiah(price.finalPrice)}
                  {price.discountAmount > 0 && (
                    <span className="ml-2 text-xs text-ink-muted line-through">{formatRupiah(price.basePrice)}</span>
                  )}
                  {/* Di layar kecil total per barang ditaruh di sini, bukan di kolom kanan. */}
                  {item.quantity > 1 && (
                    <span className="ml-2 font-normal text-ink-muted sm:hidden">
                      × {item.quantity} = <span className="font-semibold text-ink">{formatRupiah(price.finalPrice * item.quantity)}</span>
                    </span>
                  )}
                </p>
                {problem && <Alert tone="danger" title={problem} className="mt-2" />}

                <CartItemControls
                  // Dipasang ulang setiap data dari server berubah, supaya angka lokal ikut segar.
                  key={`${item.variantId}-${item.quantity}`}
                  cartItemId={item.id}
                  productName={variant.product.name}
                  quantity={item.quantity}
                  variantId={variant.id}
                  variants={
                    // Varian yang sudah nonaktif tetap ikut supaya pilihan saat ini terlihat.
                    variant.product.variants.some((v) => v.id === variant.id)
                      ? variant.product.variants
                      : [...variant.product.variants, { id: variant.id, size: variant.size, color: variant.color, stock: variant.stock }]
                  }
                  maxPerItem={MAX_PAIRS_PER_ITEM}
                />
              </div>

              <p className="tabular hidden shrink-0 text-right text-base font-semibold text-ink sm:block">
                {formatRupiah(price.finalPrice * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
        </Panel>

        <aside className="h-fit">
          <Panel title="Ringkasan">
          <dl className="tabular space-y-2.5 text-sm">
            <div className="flex justify-between text-ink-muted">
              <dt>Harga barang</dt>
              <dd className="text-ink">{formatRupiah(totals.subtotal)}</dd>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-promo-save">
                <dt>Diskon</dt>
                <dd>-{formatRupiah(totals.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-studio-line pt-3 text-base font-bold text-ink">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(totals.total)}</dd>
            </div>
          </dl>
          {pairsLeft === 0 ? (
            <p className="mt-2.5 text-xs font-semibold text-promo-save">Kamu dapat gratis ongkir untuk pesanan ini.</p>
          ) : (
            <p className="mt-2.5 text-xs text-ink-muted">
              Ongkir dihitung setelah kamu memilih alamat. Tambah {pairsLeft} pasang lagi untuk gratis ongkir.
            </p>
          )}

          {blocked ? (
            <Alert tone="danger" title="Perbaiki barang yang bermasalah di keranjang sebelum lanjut membayar." className="mt-5" />
          ) : (
            <ButtonLink href="/checkout" variant="primary" size="lg" pill className="mt-5 w-full">
              Lanjut ke Pengiriman
            </ButtonLink>
          )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
