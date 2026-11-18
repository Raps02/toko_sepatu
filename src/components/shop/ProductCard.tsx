import Image from 'next/image';
import { ProductCardGallery } from '@/components/shop/ProductCardGallery';
import { sizeRun, type ProductCardData } from '@/lib/catalog';
import { formatRupiah } from '@/lib/format';
import { resolvePrice } from '@/lib/pricing';

export function ProductImage({
  url,
  label,
  alt,
  sizes,
  priority = false,
  className = 'object-cover',
}: {
  url?: string | null;
  /** Teks pengganti saat produk belum punya foto. */
  label: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-studio-card p-4" aria-hidden>
        <span className="text-center font-display text-3xl font-bold uppercase leading-none text-asphalt-300">{label}</span>
      </div>
    );
  }
  return <Image src={url} alt={alt} fill sizes={sizes} priority={priority} unoptimized className={className} />;
}

export function PriceTag({
  basePrice,
  finalPrice,
  percentOff,
  large = false,
}: {
  basePrice: number;
  finalPrice: number;
  percentOff: number;
  large?: boolean;
}) {
  const discounted = finalPrice < basePrice;
  return (
    <p className="tabular flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className={large ? 'text-2xl font-bold tracking-tight text-ink sm:text-3xl' : 'text-[15px] font-semibold text-ink'}>
        {formatRupiah(finalPrice)}
      </span>
      {discounted && (
        <>
          <span className={`text-ink-muted line-through ${large ? 'text-base' : 'text-sm'}`}>
            <span className="sr-only">Harga sebelumnya </span>
            {formatRupiah(basePrice)}
          </span>
          <span className={`font-semibold text-promo-save ${large ? 'text-sm' : 'text-xs'}`}>
            Hemat {percentOff}%
          </span>
        </>
      )}
    </p>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const price = resolvePrice(product.basePrice, product.discounts);
  const run = sizeRun(product.variants);
  const availableSizes = run.filter((s) => s.stock > 0);
  const soldOut = availableSizes.length === 0;
  const colorCount = new Set(product.variants.map((v) => v.color)).size;

  const statusLabel = soldOut
    ? { text: 'Stok Habis', tone: 'text-ink-muted' }
    : price.percentOff > 0
      ? { text: 'Penawaran Spesial', tone: 'text-promo' }
      : null;

  const sizeRange =
    availableSizes.length > 1
      ? `Uk. ${availableSizes[0].size}–${availableSizes[availableSizes.length - 1].size}`
      : availableSizes.length === 1
        ? `Uk. ${availableSizes[0].size}`
        : null;

  return (
    <ProductCardGallery
      images={product.images}
      productName={product.name}
      href={`/products/${product.slug}`}
      soldOut={soldOut}
      percentOff={price.percentOff}
      status={statusLabel && <p className={`mt-1 text-xs font-semibold ${statusLabel.tone}`}>{statusLabel.text}</p>}
    >
      <div className="mt-1 flex flex-col gap-0.5">
        <p className="text-sm text-ink-muted">
          {product.category ? `Sepatu ${product.category.name}` : 'Sepatu'}
        </p>

        <p className="text-sm text-ink-muted">
          {colorCount > 0 ? `${colorCount} Warna` : 'Varian standar'}
          {sizeRange ? ` · ${sizeRange}` : ''}
        </p>

        <div className="mt-1.5">
          <PriceTag {...price} />
        </div>
      </div>
    </ProductCardGallery>
  );
}

export function ProductGrid({
  products,
  columns = 4,
}: {
  products: ProductCardData[];
  columns?: 3 | 4;
}) {
  const gridCols =
    columns === 3
      ? 'grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-5 lg:grid-cols-3'
      : 'grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-5 lg:grid-cols-4';

  return (
    <div className={`grid ${gridCols}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
