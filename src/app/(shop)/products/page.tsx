import type { Metadata } from 'next';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { LinkSegments } from '@/components/dashboard/LinkSegments';
import { EmptyState } from '@/components/dashboard/PageHeader';
import { ProductGrid } from '@/components/shop/ProductCard';
import { SortSelect } from '@/components/shop/SortSelect';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { countByCategory, listAvailableSizes, listProducts, SORT_OPTIONS } from '@/lib/catalog';
import { prisma } from '@/lib/prisma';
import { GENDER_LABEL, parseGenderParam } from '@/lib/sizes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Semua Sepatu' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CatalogParams = { q?: string; gender?: string; category?: string; size?: string; sort?: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

function buildCatalogHref(params: CatalogParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.gender) qs.set('gender', params.gender);
  if (params.category) qs.set('category', params.category);
  if (params.size) qs.set('size', params.size);
  if (params.sort && params.sort !== 'terbaru') qs.set('sort', params.sort);
  const query = qs.toString();
  return query ? `/products?${query}` : '/products';
}

const GENDER_TABS = [
  { value: '', label: 'Semua' },
  { value: 'pria', label: 'Pria' },
  { value: 'wanita', label: 'Wanita' },
];

type FilterGroupsProps = {
  filter: Required<CatalogParams>;
  categories: { id: string; name: string; slug: string; count: number }[];
  totalCount: number;
  sizes: string[];
};

/** Kegunaan + ukuran. Dipakai di sidebar desktop dan panel filter di HP. */
function FilterGroups({ filter, categories, totalCount, sizes }: FilterGroupsProps) {
  const rowClass = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-studio font-semibold text-ink' : 'text-ink-muted hover:bg-studio hover:text-ink'
    }`;

  return (
    <div className="space-y-8">
      <nav aria-label="Kegunaan">
        <h2 className="px-3 text-sm font-semibold text-ink">Kegunaan</h2>
        <ul className="mt-2 space-y-0.5">
          <li>
            <Link
              href={buildCatalogHref({ ...filter, category: '' })}
              aria-current={!filter.category ? 'page' : undefined}
              className={rowClass(!filter.category)}
            >
              Semua kegunaan
              <span className="tabular text-xs text-ink-muted">{totalCount}</span>
            </Link>
          </li>
          {categories.map((cat) => {
            const active = filter.category === cat.slug;
            const empty = cat.count === 0 && !active;
            return (
              <li key={cat.id}>
                {empty ? (
                  // Tidak ada yang cocok dengan filter lain: tampil redup, tidak bisa dipilih.
                  <span className={`${rowClass(false)} cursor-default opacity-45 hover:bg-transparent hover:text-ink-muted`}>
                    {cat.name}
                    <span className="tabular text-xs">0</span>
                  </span>
                ) : (
                  <Link
                    href={buildCatalogHref({ ...filter, category: active ? '' : cat.slug })}
                    aria-current={active ? 'page' : undefined}
                    className={rowClass(active)}
                  >
                    {cat.name}
                    <span className="tabular text-xs text-ink-muted">{cat.count}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {sizes.length > 0 && (
        <nav aria-label="Ukuran">
          <h2 className="px-3 text-sm font-semibold text-ink">
            Ukuran <span className="font-normal text-ink-muted">(ID/EU, ada stok)</span>
          </h2>
          <ul className="mt-3 grid grid-cols-4 gap-1.5 px-3 lg:grid-cols-3">
            {sizes.map((size) => {
              const active = filter.size === size;
              return (
                <li key={size}>
                  <ButtonLink
                    href={buildCatalogHref({ ...filter, size: active ? '' : size })}
                    aria-current={active ? 'page' : undefined}
                    aria-label={`Ukuran ${size}`}
                    variant={active ? 'primary' : 'secondary'}
                    className="tabular w-full !px-0"
                  >
                    {size}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const gender = parseGenderParam(first(params.gender));
  const filter: Required<CatalogParams> = {
    q: first(params.q).trim(),
    // Hanya 'pria' atau 'wanita'; nilai lain diabaikan.
    gender: gender ? gender.toLowerCase() : '',
    category: first(params.category),
    size: first(params.size),
    sort: Object.hasOwn(SORT_OPTIONS, first(params.sort)) ? first(params.sort) : 'terbaru',
  };
  const query = { q: filter.q, gender, category: filter.category, size: filter.size, sort: filter.sort };

  const [products, sizes, categories, counts] = await Promise.all([
    listProducts(query),
    listAvailableSizes(gender),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    countByCategory(query),
  ]);

  const categoryRows = categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  const totalCount = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const activeCategory = categories.find((c) => c.slug === filter.category);

  const base = [activeCategory ? `Sepatu ${activeCategory.name}` : 'Sepatu', gender && GENDER_LABEL[gender]]
    .filter(Boolean)
    .join(' ');
  const heading = filter.size ? `${base} Ukuran ${filter.size}` : activeCategory || gender ? base : 'Semua Sepatu';

  // Filter yang sedang aktif, masing-masing bisa dilepas sendiri.
  const chips = [
    filter.q && { label: `“${filter.q}”`, href: buildCatalogHref({ ...filter, q: '' }) },
    gender && { label: GENDER_LABEL[gender], href: buildCatalogHref({ ...filter, gender: '' }) },
    activeCategory && { label: activeCategory.name, href: buildCatalogHref({ ...filter, category: '' }) },
    filter.size && { label: `Ukuran ${filter.size}`, href: buildCatalogHref({ ...filter, size: '' }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
  const panelFilters = [filter.category, filter.size].filter(Boolean).length;

  const groups = <FilterGroups filter={filter} categories={categoryRows} totalCount={totalCount} sizes={sizes} />;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{heading}</h1>
      <p className="tabular mt-1 text-sm text-ink-muted">
        {products.length} sepatu{filter.q && <> untuk pencarian “{filter.q}”</>}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-studio-line pb-5">
        <LinkSegments
          label="Sepatu untuk"
          active={buildCatalogHref({ ...filter, size: '' })}
          options={GENDER_TABS.map((option) => ({ href: buildCatalogHref({ ...filter, gender: option.value, size: '' }), label: option.label }))}
        />

        <SortSelect
          value={filter.sort}
          options={Object.entries(SORT_OPTIONS).map(([value, option]) => ({ value, label: option.label }))}
          hidden={{ q: filter.q, gender: filter.gender, category: filter.category, size: filter.size }}
        />
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filter aktif">
          {chips.map((chip) => (
            <ButtonLink key={chip.label} href={chip.href} aria-label={`Lepas filter ${chip.label}`} size="sm" pill>
              {chip.label}
              <X className="h-3.5 w-3.5" aria-hidden />
            </ButtonLink>
          ))}
          {chips.length > 1 && (
            <ButtonLink href="/products" variant="ghost" size="sm" pill>
              Hapus semua
            </ButtonLink>
          )}
        </div>
      )}

      <div className="mt-4 lg:hidden">
        <Disclosure title={panelFilters > 0 ? `Kegunaan dan ukuran (${panelFilters} aktif)` : 'Kegunaan dan ukuran'}>{groups}</Disclosure>
      </div>

      <div className="mt-8 flex gap-10">
        <aside className="-ml-3 hidden w-56 shrink-0 lg:block">{groups}</aside>

        <div className="min-w-0 flex-1">
          {products.length > 0 ? (
            <ProductGrid products={products} columns={3} />
          ) : (
            <EmptyState
              title="Tidak ada sepatu yang cocok dengan filter ini."
              hint="Lepas salah satu filter di atas, atau lihat semua sepatu."
              action={
                <ButtonLink href="/products" variant="primary" pill>
                  Lihat semua sepatu
                </ButtonLink>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
