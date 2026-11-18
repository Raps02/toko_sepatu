import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  cancelMyOrderAction,
  confirmReceivedAction,
  payOrderAction,
  refreshPaymentStatusAction,
  resendInvoiceEmailAction,
  simulatePaymentAction,
} from '@/actions/order.actions';
import { createReviewAction, requestReturnAction } from '@/actions/service.actions';
import { Alert } from '@/components/arc/alert/alert';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { Badge } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { InvoiceDownloadButton } from '@/components/shop/InvoiceDownloadButton';
import { OrderProgress } from '@/components/shop/OrderProgress';
import { ShipmentTracking } from '@/components/shop/ShipmentTracking';
import { Stars } from '@/components/shop/Stars';
import { trackingPace, type TrackingInput } from '@/lib/tracking';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Rating } from '@/components/arc/rating/rating';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { hasInvoice } from '@/lib/invoice';
import { isMidtransConfigured } from '@/lib/midtrans';
import { syncOrderPaymentStatus } from '@/lib/midtrans-sync';
import { expireStaleOrders, lineTotal, ORDER_STATUS } from '@/lib/orders';
import { prisma } from '@/lib/prisma';
import { RETURN_STATUS } from '@/lib/returns';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Detail pesanan' };

async function loadCustomerOrder(id: string, userId: string) {
  return prisma.order.findFirst({
    where: { id, userId },
    include: {
      payment: true,
      items: { include: { review: true, returnRequests: { orderBy: { createdAt: 'desc' } } } },
    },
  });
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission('shop.buy');
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await expireStaleOrders();

  // `userId` di where: pembeli hanya bisa membuka pesanannya sendiri.
  let order = await loadCustomerOrder(id, user.id);
  if (!order) notFound();

  if (order.status === 'PENDING_PAYMENT' && order.payment?.snapToken && isMidtransConfigured()) {
    const synced = await syncOrderPaymentStatus(order.id);
    if (synced.changed) {
      order = (await loadCustomerOrder(id, user.id)) ?? order;
    }
  }

  const status = ORDER_STATUS[order.status];
  const awaitingPayment = order.status === 'PENDING_PAYMENT';
  const canSimulate = process.env.NODE_ENV !== 'production' && !isMidtransConfigured();
  // Retur baru bisa diajukan setelah pembeli mengonfirmasi pesanan sudah diterima.
  const canReturn = order.status === 'COMPLETED';
  // Data lacak paket (simulasi, lihat src/lib/tracking.ts). Hanya ada kalau kurir dan resi sudah diisi staf.
  const tracking: TrackingInput | null =
    order.courier && order.trackingNumber && order.shippedAt
      ? {
          orderNumber: order.orderNumber,
          courier: order.courier,
          trackingNumber: order.trackingNumber,
          shippedAt: order.shippedAt.toISOString(),
          recipient: order.shipRecipient,
          city: order.shipCity,
          province: order.shipProvince,
        }
      : null;
  const renderedAt = Date.now();
  const refundPending = (order.status === 'CANCELLED' || order.status === 'EXPIRED') && order.payment?.status === 'PAID';
  const txStatusParam = Array.isArray(query.transaction_status) ? query.transaction_status[0] : query.transaction_status;
  const returnedSettled = awaitingPayment && (txStatusParam === 'settlement' || txStatusParam === 'capture');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <ButtonLink href="/orders" variant="ghost" size="sm">
        Semua pesanan
      </ButtonLink>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="tabular font-display text-4xl font-bold text-ink">{order.orderNumber}</h1>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Dibuat {formatDateTime(order.createdAt)}</p>

      <div className="mt-6">
        <Panel title="Status pesanan" description={status.customerHint}>
        <OrderProgress order={order} />

        {awaitingPayment && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">
              Bayar <span className="tabular font-bold">{formatRupiah(order.total)}</span> sebelum{' '}
              <span className="font-semibold">{formatDateTime(order.expiresAt)}</span>.
            </p>
            {returnedSettled && (
              <Alert tone="info" title="Kamu baru kembali dari halaman pembayaran.">Tekan “Cek status pembayaran” di bawah untuk menyegarkan statusnya.</Alert>
            )}
            <div className="flex flex-wrap items-start gap-2.5">
              {isMidtransConfigured() && (
                <>
                  <ActionForm action={payOrderAction.bind(null, order.id)}>
                    <SubmitButton variant="ink" pendingLabel="Membuka halaman pembayaran…">
                      Bayar sekarang
                    </SubmitButton>
                  </ActionForm>
                  {order.payment?.snapToken && (
                    <ActionForm action={refreshPaymentStatusAction.bind(null, order.id)}>
                      <SubmitButton variant="pillSecondary" pendingLabel="Memeriksa pembayaran…">
                        Cek status pembayaran
                      </SubmitButton>
                    </ActionForm>
                  )}
                </>
              )}
              <ActionForm action={cancelMyOrderAction.bind(null, order.id)} confirmTone="danger" confirmLabel="Ya, batalkan" confirmMessage="Batalkan pesanan ini? Stoknya akan dilepas untuk pembeli lain.">
                <SubmitButton variant="ghost">Batalkan pesanan</SubmitButton>
              </ActionForm>
            </div>

            {canSimulate && (
              <div className="space-y-2">
                <Alert tone="warning" title="Mode development">
                  Kunci Midtrans belum diisi, jadi pembayaran sungguhan belum bisa dilakukan. Tombol ini hanya untuk uji coba dan tidak muncul di production.
                </Alert>
                <ActionForm action={simulatePaymentAction.bind(null, order.id)}>
                  <SubmitButton variant="marking" size="sm">
                    Tandai dibayar (uji coba)
                  </SubmitButton>
                </ActionForm>
              </div>
            )}
          </div>
        )}

        {(order.status === 'SHIPPED' || order.status === 'COMPLETED') && tracking && (
          <div className="mt-4">
            <ShipmentTracking input={tracking} initialNow={renderedAt} pace={trackingPace()} received={order.status === 'COMPLETED'} />
          </div>
        )}

        {order.status === 'SHIPPED' && (
          <div className="mt-4 space-y-3">
            <ActionForm action={confirmReceivedAction.bind(null, order.id)} confirmMessage="Pesanan sudah kamu terima?" confirmDescription="Pastikan sepatunya sudah sampai dan sesuai pesanan. Setelah dikonfirmasi, pesanan dianggap selesai." confirmLabel="Ya, sudah diterima">
              <SubmitButton>Pesanan sudah saya terima</SubmitButton>
            </ActionForm>
            <p className="text-xs text-ink-muted">Pengajuan pengembalian barang bisa dilakukan setelah pesanan dikonfirmasi diterima.</p>
          </div>
        )}


        {refundPending && (
          <Alert tone="warning" title="Dana pesanan ini akan dikembalikan." className="mt-3">Pembayaranmu sudah kami terima untuk pesanan yang dibatalkan ini.</Alert>
        )}
        {order.payment?.status === 'REFUNDED' && (
          <Alert tone="success" title="Dana pesanan ini sudah dikembalikan." className="mt-3" />
        )}
        </Panel>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-ink">Barang</h2>
        <ul className="mt-3 space-y-3">
          {order.items.map((item) => {
            const activeReturns = item.returnRequests.filter((r) => r.status !== 'REJECTED');
            const returnable = item.quantity - activeReturns.reduce((sum, r) => sum + r.quantity, 0);
            return (
              <li key={item.id}>
                <Panel
                  title={item.productName}
                  description={`${item.color}, ukuran ${item.size} × ${item.quantity}`}
                  aside={<span className="tabular text-sm font-normal text-ink-muted">{formatRupiah(lineTotal(item))}</span>}
                >
                {item.discountAmount > 0 && <p className="tabular text-xs text-ink-muted line-through">{formatRupiah(item.unitPrice * item.quantity)}</p>}

                {item.returnRequests.map((request) => {
                  const returnStatus = RETURN_STATUS[request.status];
                  return (
                    <div key={request.id} className="mt-3 border-t border-studio-line pt-3 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Retur {request.quantity} pasang</span>
                        <Badge tone={returnStatus.tone}>{returnStatus.label}</Badge>
                      </p>
                      <p className="mt-1 text-ink-muted">{returnStatus.customerHint}</p>
                      {request.handlerNote && <p className="mt-1">Catatan toko: {request.handlerNote}</p>}
                      {request.refundAmount != null && (
                        <p className="tabular mt-1">Nilai pengembalian dana: {formatRupiah(request.refundAmount)}</p>
                      )}
                    </div>
                  );
                })}

                {item.review ? (
                  <div className="mt-3 border-t border-studio-line pt-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      Review kamu <Stars value={item.review.rating} />
                    </p>
                    {item.review.comment && <p className="mt-1 whitespace-pre-line">{item.review.comment}</p>}
                    {item.review.reply && <p className="mt-2 border-l-2 border-court pl-3">Balasan toko: {item.review.reply}</p>}
                  </div>
                ) : (
                  order.status === 'COMPLETED' && (
                    <div className="mt-3">
                      <Disclosure title="Tulis review">
                        <ActionForm action={createReviewAction} className="space-y-3">
                        <input type="hidden" name="orderItemId" value={item.id} />
                        <Rating
                          label="Rating"
                          name="rating"
                          defaultValue={5}
                          allowClear={false}
                          valueLabels={['Kecewa', 'Kurang', 'Cukup', 'Puas', 'Sangat puas']}
                        />
                        <TextAreaField label="Ulasan" name="comment" rows={3} hint="Opsional. Ceritakan ukuran, kenyamanan, dan kualitasnya." />
                        <SubmitButton size="sm" pendingLabel="Mengirim…">
                          Kirim review
                        </SubmitButton>
                      </ActionForm>
                      </Disclosure>
                    </div>
                  )
                )}

                {canReturn && returnable > 0 && (
                  <div className="mt-3">
                    <Disclosure title="Ajukan pengembalian barang">
                      <ActionForm action={requestReturnAction} className="space-y-3">
                      <input type="hidden" name="orderItemId" value={item.id} />
                      <TextField
                        label="Jumlah yang dikembalikan (pasang)"
                        name="quantity"
                        type="number"
                        min={1}
                        max={returnable}
                        defaultValue={1}
                        required
                        wrapperClassName="max-w-64"
                      />
                      <TextAreaField
                        label="Apa yang tidak sesuai?"
                        name="reason"
                        rows={3}
                        required
                        hint="Misal: ukuran yang datang 41 padahal pesan 42, atau ada cacat di sol kiri."
                      />
                      <SubmitButton variant="secondary" size="sm" pendingLabel="Mengirim…">
                        Kirim pengajuan retur
                      </SubmitButton>
                    </ActionForm>
                    </Disclosure>
                  </div>
                )}
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Dikirim ke">
          <p className="text-sm font-medium">{order.shipRecipient}</p>
          <p className="text-ink-muted">{order.shipPhone}</p>
          <p>
            {order.shipStreet}, {order.shipCity}, {order.shipProvince} {order.shipPostalCode}
          </p>
          {order.note && <p className="mt-2 text-ink-muted">Catatan: {order.note}</p>}
        </Panel>

        <Panel title="Rincian pembayaran">
          <dl className="tabular space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Harga barang</dt>
              <dd>{formatRupiah(order.subtotal)}</dd>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between">
                <dt>Diskon</dt>
                <dd>-{formatRupiah(order.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Ongkir</dt>
              <dd>{order.shippingCost === 0 ? 'Gratis' : formatRupiah(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-studio-line pt-1 font-medium">
              <dt>Total</dt>
              <dd>{formatRupiah(order.total)}</dd>
            </div>
          </dl>
          {order.paidAt && (
            <p className="mt-2 text-ink-muted">
              Dibayar {formatDateTime(order.paidAt)}
              {order.payment?.method ? ` lewat ${order.payment.method.replace(/_/g, ' ')}` : ''}.
            </p>
          )}
          {hasInvoice(order.status) && (
            <div className="mt-4 space-y-3 border-t border-studio-line pt-4">
              <InvoiceDownloadButton orderId={order.id} />
              <ActionForm action={resendInvoiceEmailAction.bind(null, order.id)}>
                <p className="mb-2 text-xs text-ink-muted">
                  {order.invoiceEmailedAt
                    ? `Invoice sudah dikirim ke ${user.email}.`
                    : `Invoice dikirim otomatis ke ${user.email} setelah pembayaran diterima.`}
                </p>
                <SubmitButton variant="ghost" size="sm" pendingLabel="Mengirim…">
                  Kirim invoice ke email
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
