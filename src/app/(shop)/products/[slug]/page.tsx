import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb';
import { Panel } from '@/components/dashboard/Panel';
import { ProductShowcase } from '@/components/shop/ProductShowcase';
import { Stars } from '@/components/shop/Stars';
import { sortSizes } from '@/lib/catalog';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { resolvePrice } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

async function loadProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isPublished: true },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
      discounts: { where: { isActive: true } },
      variants: { where: { isActive: true }, select: { id: true, size: true, color: true, stock: true } },
      reviews: {
        where: { isHidden: false },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { user: { select: { name: true } }, orderItem: { select: { size: true, color: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, isPublished: true },
    select: { name: true, description: true },
  });
  if (!product) return { title: 'Sepatu tidak ditemukan' };
  return { title: product.name, description: product.description ?? undefined };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, user] = await Promise.all([loadProduct(slug), getCurrentUser()]);
  if (!product) notFound();

  const price = resolvePrice(product.basePrice, product.discounts);
  const sizeOrder = sortSizes([...new Set(product.variants.map((v) => v.size))]);
  const variants = product.variants.toSorted(
    (a, b) => a.color.localeCompare(b.color, 'id') || sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size),
  );

  const viewer = !user ? 'guest' : can(user.role, 'shop.buy') ? 'customer' : 'staff';
  const rating = await prisma.review.aggregate({
    where: { productId: product.id, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });
  const average = rating._avg.rating ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Semua sepatu', href: '/products' },
            ...(product.category ? [{ label: product.category.name, href: `/products?category=${product.category.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <ProductShowcase
        productName={product.name}
        gender={product.gender}
        categoryName={product.category?.name}
        description={product.description}
        images={product.images.map((i) => ({ id: i.id, url: i.url }))}
        variants={variants}
        price={price}
        ratingAvg={average}
        ratingCount={rating._count}
        viewer={viewer}
      />

      <section id="review" className="mt-20 scroll-mt-24 border-t border-studio-line pt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Ulasan Pembeli</h2>
          {rating._count > 0 && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Stars value={average} />
              <span className="tabular font-medium text-ink">
                {average.toLocaleString('id-ID', { maximumFractionDigits: 1 })} dari 5 ({rating._count} ulasan)
              </span>
            </div>
          )}
        </div>

        {product.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Belum ada ulasan. Ulasan hanya bisa ditulis pembeli yang pesanannya sudah diterima.
          </p>
        ) : (
          <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {product.reviews.map((review) => (
              <li key={review.id}>
                <Panel
                  title={review.user.name}
                  aside={<Stars value={review.rating} />}
                  description={`Ukuran ${review.orderItem.size}, ${review.orderItem.color}, ${formatDate(review.createdAt)}`}
                  className="h-full"
                >
                  {review.comment && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{review.comment}</p>}
                  {review.reply && (
                    <div className="mt-4 border-l-2 border-ink pl-3">
                      <p className="text-xs font-medium text-ink">Balasan toko</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{review.reply}</p>
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
