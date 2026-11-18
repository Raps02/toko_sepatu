import type { Metadata } from 'next';
import Link from 'next/link';
import { stockCorrectionAction, stockInAction, stockOutAction } from '@/actions/stock.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { LinkSegments } from '@/components/dashboard/LinkSegments';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { UrlPagination } from '@/components/dashboard/UrlPagination';
import { loadVariantGroups, VariantSelect } from '@/components/dashboard/VariantSelect';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DateField, SearchInput, SelectField, TextField } from '@/components/ui/Field';
import { dayRange, formatDateTime, todayKey } from '@/lib/format';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';
import { MOVEMENT_LABEL } from '@/lib/stock';
import { stockMovementFilterSchema, type StockMovementFilter } from '@/lib/validations';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'Stok' };

const LOW_STOCK_THRESHOLD = 2;
const PAGE_SIZE = 25;
/** Nilai filter "Petugas" untuk perubahan stok yang terjadi sendiri dari pesanan pembeli. */
const BY_AUTOMATIC = 'otomatis';

type SearchParams = Record<string, string | string[] | undefined>;

/** Syarat Prisma dari filter riwayat stok. */
function movementWhere(f: StockMovementFilter): Prisma.StockMovementWhereInput {
  const where: Prisma.StockMovementWhereInput = {};
  if (f.type) where.type = f.type;
  if (f.product) where.variant = { productId: f.product };
  if (f.by === BY_AUTOMATIC) where.AND = [{ OR: [{ createdById: null }, { createdBy: { role: 'CUSTOMER' } }] }];
  else if (f.by) where.createdById = f.by;
  if (f.from || f.to) {
    const from = f.from ?? f.to!;
    const to = f.to && f.to >= from ? f.to : from;
    const { start, end } = dayRange(from, to);
    where.createdAt = { gte: start, lt: end };
  }
  if (f.q) {
    const contains = { contains: f.q, mode: 'insensitive' as const };
    where.OR = [
      { note: contains },
      { order: { orderNumber: contains } },
      { variant: { product: { name: contains } } },
      { variant: { color: contains } },
      { variant: { sku: contains } },
    ];
  }
  return where;
}

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('stock.manage');
  const params = await searchParams;
  const lowOnly = params.filter === 'low';
  const appliesCorrection = can(user.role, 'stock.correct.apply');
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filter = stockMovementFilterSchema.parse({
    q: one(params.q),
    type: one(params.type),
    product: one(params.product),
    by: one(params.by),
    from: one(params.from),
    to: one(params.to),
    page: one(params.page),
  });
  const where = movementWhere(filter);
  const filtering = Boolean(filter.q || filter.type || filter.product || filter.by || filter.from || filter.to);

  const [groups, movements, movementCount, recorders] = await Promise.all([
    loadVariantGroups(),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        variant: { select: { size: true, color: true, product: { select: { name: true } } } },
        createdBy: { select: { name: true, role: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
    // Pilihan "Petugas": hanya staf. Perubahan dari pesanan pembeli masuk ke "Otomatis dari pesanan".
    prisma.user.findMany({
      where: { role: { not: 'CUSTOMER' }, stockMovements: { some: {} } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(movementCount / PAGE_SIZE));


  const visibleGroups = groups
    .map((group) => ({
      ...group,
      variants: lowOnly ? group.variants.filter((v) => v.stock <= LOW_STOCK_THRESHOLD) : group.variants,
    }))
    .filter((group) => group.variants.length > 0);

  return (
    <>
      <PageHeader
        title="Stok"
        description="Catat setiap barang yang masuk dan keluar gudang. Penjualan dari toko online mengurangi stok secara otomatis."
      />

      {groups.length === 0 ? (
        <EmptyState title="Belum ada sepatu untuk dicatat stoknya." hint="Tambahkan ukuran dan warna di menu Produk dulu." />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Barang masuk" description="Catat sepatu yang baru datang dari pemasok.">
              <ActionForm action={stockInAction} resetOnSuccess className="space-y-3">
                <VariantSelect id="in-variant" groups={groups} />
                <TextField label="Jumlah (pasang)" name="quantity" type="number" min={1} inputMode="numeric" required />
                <TextField label="Catatan" name="note" placeholder="Nomor surat jalan, pemasok" />
                <SubmitButton pendingLabel="Mencatat…" className="w-full">
                  Catat barang masuk
                </SubmitButton>
              </ActionForm>
            </Panel>

            <Panel title="Barang keluar" description="Catat sepatu yang keluar bukan lewat pesanan website: rusak, hilang, sampel, atau terjual di toko.">
              <ActionForm action={stockOutAction} resetOnSuccess className="space-y-3">
                <VariantSelect id="out-variant" groups={groups} />
                <TextField label="Jumlah (pasang)" name="quantity" type="number" min={1} inputMode="numeric" required />
                <TextField label="Alasan" name="note" placeholder="Misal: rusak, terjual di toko" required />
                <SubmitButton variant="secondary" pendingLabel="Mencatat…" className="w-full">
                  Catat barang keluar
                </SubmitButton>
              </ActionForm>
            </Panel>

            <Panel
              title="Koreksi stok"
              aside={<Badge tone={appliesCorrection ? 'dark' : 'neutral'}>{appliesCorrection ? 'Langsung berlaku' : 'Perlu persetujuan admin'}</Badge>}
              description={
                appliesCorrection
                  ? 'Samakan jumlah di sini dengan hasil hitung di gudang. Perubahan tercatat di Riwayat perubahan.'
                  : 'Pakai kalau hasil hitung di gudang berbeda. Jumlahnya berubah setelah disetujui admin.'
              }
            >
              <ActionForm action={stockCorrectionAction} resetOnSuccess className="space-y-3">
                <VariantSelect id="fix-variant" groups={groups} />
                <TextField label="Stok sebenarnya (pasang)" name="actualStock" type="number" min={0} inputMode="numeric" required />
                <TextField label="Alasan koreksi" name="reason" placeholder="Misal: hasil hitung gudang berbeda" required />
                <SubmitButton variant="secondary" pendingLabel="Menyimpan…" className="w-full">
                  {appliesCorrection ? 'Simpan koreksi' : 'Ajukan koreksi'}
                </SubmitButton>
              </ActionForm>
            </Panel>
          </div>

          <section className="mt-9">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">Stok saat ini</h2>
              <LinkSegments
                label="Saring stok"
                active={lowOnly ? '/dashboard/stock?filter=low' : '/dashboard/stock'}
                options={[
                  { href: '/dashboard/stock', label: 'Semua stok' },
                  { href: '/dashboard/stock?filter=low', label: `Sisa ${LOW_STOCK_THRESHOLD} pasang atau kurang` },
                ]}
              />
            </div>

            {visibleGroups.length === 0 ? (
              <EmptyState title="Tidak ada stok yang hampir habis." hint={`Semua ukuran masih punya lebih dari ${LOW_STOCK_THRESHOLD} pasang.`} />
            ) : (
              <DataTable
                caption="Stok saat ini"
                columns={[
                  { key: 'product', label: 'Produk', width: '24%' },
                  { key: 'color', label: 'Warna', width: '16%' },
                  { key: 'sizes', label: 'Sisa per ukuran' },
                ]}
                rows={visibleGroups.flatMap((group) =>
                  [...new Set(group.variants.map((v) => v.color))].map((color) => ({
                    id: `${group.productId}-${color}`,
                    sort: { product: group.productName, color },
                    cells: {
                      product: (
                        <Link href={`/dashboard/products/${group.productId}`} className="font-medium text-ink hover:underline">
                          {group.productName}
                        </Link>
                      ),
                      color,
                      sizes: (
                        <div className="flex flex-wrap gap-1.5 py-2">
                          {group.variants
                            .filter((v) => v.color === color)
                            .map((variant) => (
                              <Badge key={variant.id} tone={variant.stock === 0 ? 'bad' : variant.stock <= LOW_STOCK_THRESHOLD ? 'warn' : 'neutral'}>
                                Uk. {variant.size}: {variant.stock}
                              </Badge>
                            ))}
                        </div>
                      ),
                    },
                  })),
                )}
              />
            )}
          </section>
        </>
      )}

      <section id="riwayat-stok" className="mt-9 scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Riwayat stok</h2>
          <p className="tabular text-xs text-ink-muted">
            {movementCount.toLocaleString('id-ID')} catatan{filtering ? ' sesuai filter' : ''}
          </p>
        </div>

        {/* Filter lewat query string: hasilnya bisa di-bookmark atau dibagikan ke admin. */}
        <div className="mb-3">
          <Panel title="Saring riwayat">
        <form method="get" action="/dashboard/stock#riwayat-stok" role="search" aria-label="Filter riwayat stok" >
          {lowOnly && <input type="hidden" name="filter" value="low" />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SearchInput label="Cari" name="q" defaultValue={filter.q ?? ''} placeholder="Nama sepatu, warna, nomor order, atau catatan" wrapperClassName="sm:col-span-2" />
            <SelectField label="Jenis" name="type" defaultValue={filter.type ?? ''}>
              <option value="">Semua jenis</option>
              {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField label="Produk" name="product" defaultValue={filter.product ?? ''}>
              <option value="">Semua produk</option>
              {groups.map((group) => (
                <option key={group.productId} value={group.productId}>
                  {group.productName}
                </option>
              ))}
            </SelectField>
            <SelectField label="Petugas" name="by" defaultValue={filter.by ?? ''} wrapperClassName="sm:col-span-2">
              <option value="">Semua petugas</option>
              {recorders.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
              <option value={BY_AUTOMATIC}>Otomatis dari pesanan</option>
            </SelectField>
            <DateField label="Dari tanggal" name="from" max={todayKey()} defaultValue={filter.from ?? ''} />
            <DateField label="Sampai tanggal" name="to" max={todayKey()} defaultValue={filter.to ?? ''} />
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
              {filtering && (
                <ButtonLink href={`/dashboard/stock${lowOnly ? '?filter=low' : ''}#riwayat-stok`} variant="ghost">
                  Hapus filter
                </ButtonLink>
              )}
              <Button type="submit">Terapkan filter</Button>
            </div>
          </div>
        </form>
          </Panel>
        </div>

        {movements.length === 0 ? (
          filtering ? (
            <EmptyState title="Tidak ada catatan yang sesuai." hint="Coba hapus sebagian filter, misalnya tanggal atau kata kunci." />
          ) : (
            <EmptyState title="Belum ada riwayat stok." />
          )
        ) : (
          <>
            <DataTable
              caption="Riwayat stok"
              columns={[
                { key: 'time', label: 'Waktu', width: 150 },
                { key: 'product', label: 'Produk' },
                { key: 'type', label: 'Jenis' },
                { key: 'quantity', label: 'Jumlah', numeric: true },
                { key: 'after', label: 'Sisa stok', numeric: true },
                { key: 'note', label: 'Keterangan' },
                { key: 'by', label: 'Petugas' },
              ]}
              rows={movements.map((movement) => {
                const by = movement.createdBy && movement.createdBy.role !== 'CUSTOMER' ? movement.createdBy.name : 'Otomatis dari pesanan';
                return {
                  id: movement.id,
                  sort: {
                    time: movement.createdAt.getTime(),
                    product: movement.variant.product.name,
                    type: MOVEMENT_LABEL[movement.type],
                    quantity: movement.quantity,
                    after: movement.stockAfter,
                    by,
                  },
                  cells: {
                    time: <span className="text-xs text-ink-muted">{formatDateTime(movement.createdAt)}</span>,
                    product: (
                      <>
                        <span className="font-medium">{movement.variant.product.name}</span>
                        <p className="text-xs text-ink-muted">
                          {movement.variant.color}, ukuran {movement.variant.size}
                        </p>
                      </>
                    ),
                    type: <Badge tone={movement.quantity > 0 ? 'good' : movement.type === 'SALE' ? 'neutral' : 'warn'}>{MOVEMENT_LABEL[movement.type]}</Badge>,
                    quantity: <span className={movement.quantity > 0 ? 'text-promo-save' : undefined}>{movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}</span>,
                    after: movement.stockAfter,
                    note: <span className="text-xs">{movement.order ? `Order ${movement.order.orderNumber}` : movement.note}</span>,
                    by: <span className="text-xs text-ink-muted">{by}</span>,
                  },
                };
              })}
            />
            {pageCount > 1 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="tabular text-ink-muted">
                  Halaman {filter.page} dari {pageCount}
                </span>
                <UrlPagination label="Halaman riwayat stok" page={filter.page} pageCount={pageCount} hash="#riwayat-stok" />
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
