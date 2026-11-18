import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/arc/alert/alert';
import { changePriceAction, createDiscountAction, endDiscountAction } from '@/actions/pricing.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { DateField, SelectField, TextField } from '@/components/ui/Field';
import { formatDate, formatRupiah, todayKey } from '@/lib/format';
import { can } from '@/lib/permissions';
import { isDiscountLive, resolvePrice } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Harga & diskon' };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const user = await requirePagePermission(
    // Halaman ini terbuka untuk yang boleh menerapkan maupun yang hanya boleh mengajukan.
    'product.manage',
  );
  const { product: selectedId } = await searchParams;
  const appliesDirectly = can(user.role, 'price.apply');

  const [products, pendingCount] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { discounts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } } },
    }),
    prisma.changeRequest.count({
      where: {
        status: 'PENDING',
        type: { in: ['PRICE_CHANGE', 'DISCOUNT'] },
        ...(appliesDirectly ? {} : { requestedById: user.id }),
      },
    }),
  ]);

  const productOptions = products.map((product) => (
    <option key={product.id} value={product.id}>
      {product.name} ({formatRupiah(product.basePrice)})
    </option>
  ));
  const defaultProduct = products.some((p) => p.id === selectedId) ? selectedId : '';
  const now = new Date();

  return (
    <>
      <PageHeader
        tag={appliesDirectly ? 'Langsung berlaku' : 'Perlu persetujuan admin'}
        title="Harga dan diskon"
        description={
          appliesDirectly
            ? 'Perubahan harga dan promo dari halaman ini langsung berlaku di toko dan tercatat di riwayat audit.'
            : 'Perubahan dari supervisor masuk sebagai pengajuan ke admin. Harga di toko berubah setelah disetujui.'
        }
      />

      {pendingCount > 0 && (
        <Alert
          tone="warning"
          className="mb-6"
          title={
            appliesDirectly
              ? `${pendingCount} pengajuan harga atau diskon menunggu keputusanmu.`
              : `${pendingCount} pengajuanmu masih menunggu persetujuan admin.`
          }
        >
          <Link href="/dashboard/approvals" className="font-medium underline">
            Buka daftar persetujuan
          </Link>
        </Alert>
      )}

      {products.length === 0 ? (
        <EmptyState title="Belum ada produk." hint="Tambah produk dulu dari menu Produk." />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Ubah harga dasar">
              <ActionForm action={changePriceAction} resetOnSuccess className="space-y-4">
                <SelectField id="price-product" label="Produk" name="productId" defaultValue={defaultProduct}>
                  <option value="" disabled>
                    Pilih produk
                  </option>
                  {productOptions}
                </SelectField>
                <TextField label="Harga baru (Rp)" name="newPrice" type="number" min={1000} inputMode="numeric" required />
                <TextField label="Alasan" name="reason" placeholder="Misal: penyesuaian biaya produksi" required />
                <SubmitButton pendingLabel="Menyimpan…">{appliesDirectly ? 'Ubah harga' : 'Ajukan perubahan harga'}</SubmitButton>
              </ActionForm>
            </Panel>

            <Panel title="Pasang promo diskon" description="Satu produk hanya punya satu diskon aktif. Diskon baru menggantikan diskon lama.">
              <ActionForm action={createDiscountAction} resetOnSuccess className="space-y-4">
                <SelectField id="discount-product" label="Produk" name="productId" defaultValue={defaultProduct}>
                  <option value="" disabled>
                    Pilih produk
                  </option>
                  {productOptions}
                </SelectField>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Jenis" name="type" defaultValue="PERCENT">
                    <option value="PERCENT">Persen (%)</option>
                    <option value="FIXED">Potongan rupiah</option>
                  </SelectField>
                  <TextField label="Nilai" name="value" type="number" min={1} inputMode="numeric" required hint="Persen maksimal 90." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DateField label="Mulai" name="startsAt" defaultValue={todayKey()} />
                  <DateField label="Selesai" name="endsAt" hint="Kosongkan jika tanpa batas." />
                </div>
                <TextField label="Alasan" name="reason" placeholder="Misal: promo pekan ini" required />
                <SubmitButton pendingLabel="Menyimpan…">{appliesDirectly ? 'Pasang diskon' : 'Ajukan diskon'}</SubmitButton>
              </ActionForm>
            </Panel>
          </div>

          <section className="mt-9">
            <h2 className="mb-3 text-base font-bold text-ink">Daftar harga dan diskon aktif</h2>
            <DataTable
              caption="Daftar harga dan diskon"
              columns={[
                { key: 'product', label: 'Produk' },
                { key: 'base', label: 'Harga dasar', numeric: true },
                { key: 'discount', label: 'Diskon' },
                { key: 'final', label: 'Harga di toko', numeric: true },
                { key: 'actions', label: 'Tindakan' },
              ]}
              rows={products.map((product) => {
                const discount = product.discounts[0];
                const price = resolvePrice(product.basePrice, product.discounts, now);
                const live = discount ? isDiscountLive(discount, now) : false;
                return {
                  id: product.id,
                  sort: { product: product.name, base: product.basePrice, final: price.finalPrice },
                  cells: {
                    product: (
                      <>
                        <span className="font-medium">{product.name}</span>
                        <p className="text-xs text-ink-muted">{product.brand}</p>
                      </>
                    ),
                    base: formatRupiah(product.basePrice),
                    discount: discount ? (
                      <>
                        <Badge tone={live ? 'warn' : 'neutral'}>{discount.type === 'PERCENT' ? `${discount.value}%` : formatRupiah(discount.value)}</Badge>
                        <p className="mt-1 text-xs text-ink-muted">
                          {live ? 'Berlaku' : discount.startsAt > now ? 'Mulai' : 'Berakhir'} {formatDate(discount.startsAt)}
                          {discount.endsAt ? ` s.d. ${formatDate(new Date(discount.endsAt.getTime() - 1))}` : ', tanpa batas'}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-ink-muted">Tidak ada</span>
                    ),
                    final: formatRupiah(price.finalPrice),
                    actions:
                      discount && appliesDirectly ? (
                        <ActionForm
                          action={endDiscountAction.bind(null, discount.id)}
                          confirmMessage={`Akhiri diskon ${product.name} sekarang? Harga di toko kembali ke ${formatRupiah(product.basePrice)}.`}
                          showSuccess={false}
                        >
                          <SubmitButton variant="ghost" size="sm">
                            Akhiri diskon
                          </SubmitButton>
                        </ActionForm>
                      ) : null,
                  },
                };
              })}
            />
          </section>
        </>
      )}
    </>
  );
}
