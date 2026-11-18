import type { Metadata } from 'next';
import { deleteShippingRateAction, saveShippingRateAction } from '@/actions/account.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { formatRupiah } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Ongkir' };

export default async function ShippingPage() {
  await requirePagePermission('shipping.manage');
  const rates = await prisma.shippingRate.findMany({ orderBy: { province: 'asc' } });

  return (
    <>
      <PageHeader
        title="Tarif ongkir"
        description="Ongkir flat per provinsi. Pembeli hanya dapat memilih alamat dari provinsi yang terdaftar di bawah."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        <section>
          {rates.length === 0 ? (
            <EmptyState title="Belum ada wilayah pengiriman." hint="Tanpa ongkir, pembeli tidak bisa menambah alamat dan checkout." />
          ) : (
            <DataTable
              caption="Tarif ongkir per provinsi"
              defaultSort={{ key: 'province', direction: 'asc' }}
              columns={[
                { key: 'province', label: 'Provinsi' },
                { key: 'cost', label: 'Ongkir', numeric: true },
                { key: 'actions', label: 'Tindakan', numeric: true },
              ]}
              rows={rates.map((rate) => ({
                id: rate.id,
                sort: { province: rate.province, cost: rate.cost },
                cells: {
                  province: rate.province,
                  cost: formatRupiah(rate.cost),
                  actions: (
                    <ActionForm
                      action={deleteShippingRateAction.bind(null, rate.id)}
                      showSuccess={false}
                      confirmTone="danger"
                      confirmLabel="Ya, hapus"
                      confirmMessage={`Hapus ongkir ke ${rate.province}? Pembeli di provinsi ini tidak akan bisa checkout.`}
                    >
                      <SubmitButton variant="ghost" size="sm">
                        Hapus
                      </SubmitButton>
                    </ActionForm>
                  ),
                },
              }))}
            />
          )}
        </section>

        <aside className="h-fit">
          <Panel title="Tambah atau ubah ongkir" description="Isi nama provinsi yang sudah ada untuk memperbarui ongkirnya.">
          <ActionForm action={saveShippingRateAction} resetOnSuccess className="space-y-3">
            <TextField label="Provinsi" name="province" placeholder="Misal: Jawa Barat" required />
            <TextField label="Ongkir (Rp)" name="cost" type="number" min={0} inputMode="numeric" required />
            <SubmitButton pendingLabel="Menyimpan…" className="w-full">
              Simpan ongkir
            </SubmitButton>
          </ActionForm>
          </Panel>
        </aside>
      </div>
    </>
  );
}
