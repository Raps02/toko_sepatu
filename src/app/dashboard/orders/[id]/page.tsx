import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  cancelOrderAction,
  completeOrderAction,
  correctShippingAction,
  markPaymentRefundedAction,
  processOrderAction,
  shipOrderAction,
} from '@/actions/order.actions';
import { Alert } from '@/components/arc/alert/alert';
import { Timeline } from '@/components/arc/timeline/timeline';
import { DataTable } from '@/components/dashboard/DataTable';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { Badge, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { TextField } from '@/components/ui/Field';
import { formatRupiah } from '@/lib/format';
import { isMidtransConfigured } from '@/lib/midtrans';
import { syncOrderPaymentStatus } from '@/lib/midtrans-sync';
import { lineTotal, ORDER_STATUS } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Detail order' };

async function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      payment: true,
      items: { include: { variant: { select: { sku: true, stock: true } } } },
    },
  });
}

export default async function DashboardOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('order.process');
  const { id } = await params;

  let order = await loadOrder(id);
  if (!order) notFound();

  if (order.status === 'PENDING_PAYMENT' && order.payment?.snapToken && isMidtransConfigured()) {
    const synced = await syncOrderPaymentStatus(order.id);
    if (synced.changed) {
      order = (await loadOrder(id)) ?? order;
    }
  }

  const info = ORDER_STATUS[order.status];
  const appliesCorrection = can(user.role, 'order.correct.apply');
  const canCancel = ['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(order.status);
  const canShip = order.status === 'PAID' || order.status === 'PROCESSING';
  const shipped = order.status === 'SHIPPED' || order.status === 'COMPLETED';
  const refundDue = (order.status === 'CANCELLED' || order.status === 'EXPIRED') && order.payment?.status === 'PAID';

  const timeline: [string, Date | null][] = [
    ['Dibuat', order.createdAt],
    ['Dibayar', order.paidAt],
    ['Mulai disiapkan', order.processedAt],
    ['Dikirim', order.shippedAt],
    ['Selesai', order.completedAt],
    ['Dibatalkan', order.cancelledAt],
  ];

  return (
    <>
      <ButtonLink href="/dashboard/orders" variant="ghost" size="sm" className="mb-3">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Semua order
      </ButtonLink>
      <PageHeader title={order.orderNumber} actions={<Badge tone={info.tone}>{info.label}</Badge>} />

      {refundDue && (
        <div className="mb-6 space-y-3">
          <Alert tone="warning" title={`Dana ${formatRupiah(order.payment?.grossAmount ?? order.total)} perlu dikembalikan ke pembeli.`}>
            Order ini batal, tetapi pembayarannya sudah masuk. Kembalikan dananya lewat dashboard Midtrans atau transfer, lalu tandai di sini.
          </Alert>
          {appliesCorrection ? (
            <ActionForm
              action={markPaymentRefundedAction.bind(null, order.id)}
              confirmMessage="Pastikan dana benar-benar sudah dikembalikan. Tandai sudah direfund?"
              
            >
              <SubmitButton variant="marking" size="sm">
                Tandai sudah direfund
              </SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-muted">Hanya admin yang bisa menandai refund.</p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Panel title="Barang yang harus disiapkan">
            <DataTable
              caption="Barang yang harus disiapkan"
              columns={[
                { key: 'item', label: 'Barang' },
                { key: 'sku', label: 'SKU' },
                { key: 'quantity', label: 'Jumlah', numeric: true },
                { key: 'price', label: 'Harga', numeric: true },
              ]}
              rows={order.items.map((item) => ({
                id: item.id,
                cells: {
                  item: (
                    <>
                      <span className="font-medium">{item.productName}</span>
                      <p className="text-xs text-ink-muted">
                        {item.color}, ukuran {item.size}
                      </p>
                    </>
                  ),
                  sku: <span className="text-xs text-ink-muted">{item.variant.sku}</span>,
                  quantity: item.quantity,
                  price: formatRupiah(lineTotal(item)),
                },
              }))}
            />
            <dl className="tabular mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Ongkir</dt>
                <dd>{formatRupiah(order.shippingCost)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <dt>Total dibayar pembeli</dt>
                <dd>{formatRupiah(order.total)}</dd>
              </div>
            </dl>
          </Panel>

          {order.status === 'PAID' && (
            <Panel title="Langkah berikutnya: siapkan barang" description="Tandai supaya staf lain tahu order ini sudah ada yang mengerjakan.">
              <ActionForm action={processOrderAction.bind(null, order.id)}>
                <SubmitButton>Mulai siapkan order</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {canShip && (
            <Panel title="Kirim order">
              <ActionForm action={shipOrderAction} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="orderId" value={order.id} />
                <TextField label="Kurir" name="courier" placeholder="JNE, J&T, SiCepat" required />
                <TextField label="Nomor resi" name="trackingNumber" required />
                <div className="sm:pt-6">
                  <SubmitButton pendingLabel="Menyimpan…">Tandai sudah dikirim</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}

          {shipped && (
            <Panel title="Pengiriman">
              <p className="text-sm text-ink">
                {order.courier}, resi <span className="tabular font-medium">{order.trackingNumber}</span>
              </p>

              {order.status === 'SHIPPED' && (
                <ActionForm
                  action={completeOrderAction.bind(null, order.id)}
                  confirmMessage="Tandai order ini sudah diterima pembeli?"
                  className="mt-3"
                >
                  <SubmitButton variant="secondary" size="sm">
                    Tandai sudah diterima pembeli
                  </SubmitButton>
                </ActionForm>
              )}

              <div className="mt-4">
                <Disclosure title="Kurir atau resi salah input?">
                <p className="text-sm text-ink-muted">
                  {appliesCorrection
                    ? 'Koreksi langsung berlaku dan tercatat di riwayat perubahan.'
                    : 'Koreksi menjadi pengajuan dan baru berlaku setelah disetujui admin.'}
                </p>
                <ActionForm action={correctShippingAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <TextField label="Kurir yang benar" name="courier" defaultValue={order.courier ?? ''} required />
                  <TextField label="Nomor resi yang benar" name="trackingNumber" defaultValue={order.trackingNumber ?? ''} required />
                  <TextField label="Alasan koreksi" name="reason" required wrapperClassName="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <SubmitButton variant="secondary" size="sm">
                      {appliesCorrection ? 'Simpan koreksi' : 'Ajukan koreksi'}
                    </SubmitButton>
                  </div>
                </ActionForm>
              </Disclosure>
              </div>
            </Panel>
          )}

          {canCancel && (
            <Panel
              title="Batalkan order"
              tone="danger"
              description={`Stok dikembalikan otomatis. ${
                order.status === 'PENDING_PAYMENT' ? 'Order ini belum dibayar.' : 'Order ini sudah dibayar, jadi dananya harus dikembalikan ke pembeli setelah dibatalkan.'
              }`}
            >
              <ActionForm
                action={cancelOrderAction.bind(null, order.id)}
                confirmTone="danger" confirmLabel="Ya, batalkan" confirmMessage={`Batalkan order ${order.orderNumber}? Tindakan ini tidak bisa dibatalkan.`}
              >
                <SubmitButton variant="danger" size="sm">
                  Batalkan order ini
                </SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </div>

        <aside className="space-y-5 text-sm">
          <Panel title="Kirim ke">
            <p className="font-medium text-ink">{order.shipRecipient}</p>
            <p className="text-ink-muted">{order.shipPhone}</p>
            <p className="mt-1 text-ink">
              {order.shipStreet}, {order.shipCity}, {order.shipProvince} {order.shipPostalCode}
            </p>
            {order.note && (
              <Alert tone="warning" title="Catatan pembeli" className="mt-3">
                {order.note}
              </Alert>
            )}
          </Panel>

          <Panel title="Pembeli">
            <p className="font-medium text-ink">{order.user.name}</p>
            <p className="break-all text-ink-muted">{order.user.email}</p>
            {order.user.phone && <p className="text-ink-muted">{order.user.phone}</p>}
          </Panel>

          <Panel title="Riwayat">
            <Timeline
              label="Riwayat order"
              now={Date.now()}
              timeZone="Asia/Jakarta"
              headingLevel={4}
              events={timeline.flatMap(([label, date]) => (date ? [{ id: label, at: date.getTime(), title: label }] : []))}
            />
            {order.payment?.method && <p className="mt-3 border-t border-studio-line pt-3 text-xs text-ink-muted">Metode bayar: {order.payment.method.replace(/_/g, ' ')}</p>}
          </Panel>
        </aside>
      </div>
    </>
  );
}
