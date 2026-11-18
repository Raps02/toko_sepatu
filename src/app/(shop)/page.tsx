import Link from 'next/link';
import { ArrowRight, BadgePercent, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Card } from '@/components/arc/card/card';
import { Badge, EmptyState } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { HeroBannerCarousel, type HeroSlide } from '@/components/shop/HeroBannerCarousel';
import { ProductGrid, ProductImage } from '@/components/shop/ProductCard';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { listAvailableSizes, listDiscountedProducts, listProducts } from '@/lib/catalog';
import { formatRupiah } from '@/lib/format';
import { resolvePrice } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

const trustItems = [
  { icon: Truck, title: 'Gratis Ongkir', desc: 'Beli minimal 2 pasang dalam satu pesanan, ke seluruh wilayah.' },
  { icon: ShieldCheck, title: 'Stok Terverifikasi', desc: 'Ukuran yang tampil selalu sesuai stok gudang.' },
  { icon: RotateCcw, title: 'Tukar Ukuran 7 Hari', desc: 'Salah pilih ukuran? Ajukan retur dengan mudah.' },
  { icon: BadgePercent, title: 'Harga Transparan', desc: 'Promo langsung terlihat tanpa kode tersembunyi.' },
];

const categoryTaglines: Record<string, string> = {
  lari: 'Bantalan responsif untuk lari harian & 10K',
  kasual: 'Siluet bersih untuk aktivitas sehari-hari',
  futsal: 'Traksi sol karet non-marking lapangan indoor',
  formal: 'Kulit pilihan dengan konstruksi sol jahit',
};

const heroSlides: HeroSlide[] = [
  {
    id: 'performa',
    image: '/images/hero-campaign.jpg',
    alt: `Koleksi sepatu lari performa ${SITE.name}`,
    eyebrow: `Koleksi Performa & Harian ${SITE.name}`,
    titleLines: ['Langkah Pertama.', 'Tanpa Kompromi.'],
    description:
      'Sepatu lari, kasual, futsal, dan formal dengan stok per ukuran yang selalu diperbarui. Pilih ukuranmu, kami siapkan sisanya.',
    primaryCta: { label: 'Belanja Sekarang', href: '/products' },
    secondaryCta: { label: 'Jelajahi Lari', href: '/products?category=lari' },
  },
  {
    id: 'kasual',
    image: '/images/hero-kasual.jpg',
    alt: `Koleksi sneaker kasual & platform ${SITE.name}`,
    eyebrow: `Koleksi Kasual & Wanita ${SITE.name}`,
    titleLines: ['Gaya Bersih.', 'Siap Setiap Hari.'],
    description:
      'Sneaker kanvas potongan rendah dan platform 4 cm yang ringan dipadukan untuk kuliah, kerja santai, hingga akhir pekan.',
    primaryCta: { label: 'Jelajahi Kasual', href: '/products?category=kasual' },
    secondaryCta: { label: 'Koleksi Wanita', href: '/products?gender=wanita' },
  },
  {
    id: 'futsal',
    image: '/images/hero-futsal.jpg',
    alt: `Koleksi sepatu futsal indoor ${SITE.name}`,
    eyebrow: 'Koleksi Futsal Lapangan Indoor',
    titleLines: ['Kendali Penuh.', 'Di Setiap Sentuhan.'],
    description:
      'Upper kulit bertekstur dengan sol karet non-marking untuk traksi tajam dan kendali bola di lapangan indoor.',
    primaryCta: { label: 'Jelajahi Futsal', href: '/products?category=futsal' },
    secondaryCta: { label: 'Semua Sepatu', href: '/products' },
  },
  {
    id: 'formal',
    image: '/images/hero-formal.jpg',
    alt: `Koleksi sepatu formal kulit ${SITE.name}`,
    eyebrow: 'Koleksi Formal & Kerja',
    titleLines: ['Siluet Klasik.', 'Siap Ke Kantor.'],
    description:
      'Pantofel kulit pilihan dengan konstruksi sol jahit dan hak kokoh untuk tampilan rapi di kantor maupun acara resmi.',
    primaryCta: { label: 'Jelajahi Formal', href: '/products?category=formal' },
    secondaryCta: { label: 'Koleksi Pria', href: '/products?gender=pria' },
  },
];

export default async function HomePage() {
  const [sizes, newest, discounted, categories] = await Promise.all([
    listAvailableSizes(),
    listProducts({ take: 8 }),
    listDiscountedProducts(4),
    prisma.category.findMany({
      where: { products: { some: { isPublished: true } } },
      orderBy: { name: 'asc' },
      include: {
        products: {
          where: { isPublished: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        },
        _count: { select: { products: { where: { isPublished: true } } } },
      },
    }),
  ]);

  // Pilih maksimal 2 produk unggulan yang berbeda untuk blok sorotan utama.
  const featuredCandidates = [...discounted, ...newest];
  const featured = featuredCandidates.filter(
    (item, idx, arr) => arr.findIndex((other) => other.id === item.id) === idx,
  ).slice(0, 2);

  return (
    <div className="pb-6">
      {/* 1. Hero Campaign Banner Slider */}
      <HeroBannerCarousel slides={heroSlides} />

      <div className="mx-auto max-w-[1440px] space-y-20 px-4 pt-14 sm:px-8 lg:px-12">
        {/* 2. Pilihan Utama (Featured) */}
        {featured.length > 0 && (
          <section aria-labelledby="heading-featured">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 id="heading-featured" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Pilihan Utama
              </h2>
              <ButtonLink href="/products" variant="ghost" size="sm" pill>
                Lihat semua
              </ButtonLink>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {featured.map((product) => {
                const price = resolvePrice(product.basePrice, product.discounts);
                return (
                  <Card
                    key={product.id}
                    title={product.name}
                    media={
                      <div className="relative aspect-[16/11] w-full bg-studio-card">
                        <ProductImage
                          url={product.images[0]?.url}
                          label={product.name}
                          alt={product.name}
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="object-cover object-[50%_58%]"
                        />
                      </div>
                    }
                  >
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge>{product.category ? `Sepatu ${product.category.name}` : 'Sepatu'}</Badge>
                      {price.percentOff > 0 && <Badge tone="warn">Hemat {price.percentOff}%</Badge>}
                    </div>
                    {product.description && <p className="mt-2 line-clamp-2 max-w-md text-sm text-ink-muted">{product.description}</p>}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="tabular text-base font-semibold text-ink">{formatRupiah(price.finalPrice)}</span>
                      <ButtonLink href={`/products/${product.slug}`} variant="primary" pill aria-label={`Beli ${product.name}`}>
                        Beli
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </ButtonLink>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Koleksi Terbaru */}
        <section aria-labelledby="heading-newest">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="heading-newest" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Koleksi Terbaru
              </h2>
              <p className="mt-1 text-sm text-ink-muted">Sepatu siap kirim dengan ketersediaan ukuran real-time.</p>
            </div>
            <ButtonLink href="/products" pill>
              Semua sepatu
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>

          {newest.length > 0 ? (
            <ProductGrid products={newest} />
          ) : (
            <EmptyState title="Katalog masih kosong" hint="Produk yang ditayangkan dari dashboard akan tampil di sini." />
          )}
        </section>

        {/* 4. Belanja Berdasarkan Kegunaan */}
        {categories.length > 0 && (
          <section aria-labelledby="heading-categories">
            <div className="mb-6">
              <h2 id="heading-categories" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Belanja Berdasarkan Kegunaan
              </h2>
              <p className="mt-1 text-sm text-ink-muted">Temukan konstruksi sol dan material yang dirancang untuk aktivitasmu.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {categories.map((category) => {
                const sampleImage = category.products[0]?.images[0]?.url;
                const tagline = categoryTaglines[category.slug] ?? `${category._count.products} model tersedia`;
                return (
                  <Card
                    key={category.id}
                    title={
                      <Link href={`/products?category=${category.slug}`} className="after:absolute after:inset-0 after:z-0">
                        {category.name}
                      </Link>
                    }
                    description={tagline}
                    media={
                      <div className="relative aspect-square w-full bg-studio-card">
                        <ProductImage url={sampleImage} label={category.name} alt={`Sepatu kategori ${category.name}`} sizes="(min-width: 1024px) 25vw, 50vw" />
                      </div>
                    }
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Penawaran Spesial / Lagi Diskon */}
        {discounted.length > 0 && (
          <section aria-labelledby="heading-promo" className="rounded-2xl bg-studio p-6 sm:p-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="heading-promo" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Harga Spesial Pekan Ini
                </h2>
              </div>
              <ButtonLink href="/products" variant="primary" pill>
                Lihat semua
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </div>
            <ProductGrid products={discounted} />
          </section>
        )}

        {/* 6. Cari Berdasarkan Ukuran */}
        <section aria-labelledby="heading-sizes" className="border-y border-studio-line py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="heading-sizes" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Pilih Berdasarkan Ukuran Kakimu
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Hanya menampilkan sepatu yang ukurannya benar-benar tersedia di stok saat ini.
              </p>
            </div>
            {sizes.length > 0 && (
              <ButtonLink href="/products" variant="ghost" size="sm" pill>
                Semua ukuran
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            )}
          </div>

          {sizes.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Pilih ukuran sepatu">
              {sizes.map((size) => (
                <li key={size}>
                  <ButtonLink href={`/products?size=${encodeURIComponent(size)}`} className="tabular">
                    EU {size}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyState title="Belum ada ukuran tersedia" hint="Stok akan muncul di sini begitu toko mencatat barang masuk." />
            </div>
          )}
        </section>

        {/* 7. Keunggulan Toko */}
        <section aria-label="Keunggulan toko" className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(({ icon: Icon, title, desc }) => (
            <Panel
              key={title}
              title={
                <span className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {title}
                </span>
              }
              description={desc}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
