import type { Metadata } from 'next';
import type { ReturnStatus } from '@prisma/client';
import Link from 'next/link';
import { handleReturnAction } from '@/actions/service.actions';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { lineTotal } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { RETURN_STATUS } from '@/lib/returns';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Retur' };

const OPEN: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED'];

export default async function ReturnsPage() {
  const user = await requirePagePermission('return.handle');
  const canRefund = can(user.role, 'return.refund');

  const returns = await prisma.returnRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true } },
      handledBy: { select: { name: true } },
      orderItem: { include: { order: { select: { id: true, orderNumber: true } } } },
    },
  });
  const open = returns.filter((r) => OPEN.includes(r.status));
  const closed = returns.filter((r) => !OPEN.includes(r.status));

  return (
    <>
      <PageHeader
        title="Pengajuan retur"
        description="Pengajuan pengembalian barang dari pembeli. Alur: tinjau pengajuan, terima barang, lalu kembalikan dana."
      />

      <h2 className="mb-3 text-base font-bold text-ink">Sedang berjalan</h2>
      {open.length === 0 ? (
        <EmptyState title="Tidak ada retur yang perlu ditangani." />
      ) : (
        <ul className="space-y-4">
          {open.map((request) => {
            const status = RETURN_STATUS[request.status];
            const item = request.orderItem;
            const refundValue = request.refundAmount ?? lineTotal({ ...item, quantity: request.quantity });
            return (
              <li key={request.id}>
                <Panel
                  title={`${item.productName}, ${item.color}, ukuran ${item.size} × ${request.quantity}`}
                  aside={<Badge tone={status.tone}>{status.label}</Badge>}
                >
                <p className="text-xs text-ink-muted">
                  {request.user.name}, order{' '}
                  <Link href={`/dashboard/orders/${item.order.id}`} className="font-medium text-ink underline">
                    {item.order.orderNumber}
                  </Link>
                  , diajukan {formatDateTime(request.createdAt)}
                </p>
                <p className="mt-3 whitespace-pre-line rounded-lg bg-pavement px-3.5 py-2.5 text-sm text-ink">{request.reason}</p>
                <p className="tabular mt-2.5 text-sm text-ink">
                  Nilai pengembalian dana: <span className="font-medium">{formatRupiah(refundValue)}</span>
                </p>
                {request.handlerNote && <p className="mt-1 text-sm text-ink-muted">Catatan toko: {request.handlerNote}</p>}

                <div className="mt-4 border-t border-studio-line pt-4">
                  {request.status === 'REQUESTED' && (
                    <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                      <ActionForm action={handleReturnAction} showSuccess={false}>
                        <input type="hidden" name="returnId" value={request.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <SubmitButton>Setujui retur</SubmitButton>
                      </ActionForm>
                      <ActionForm action={handleReturnAction} showSuccess={false} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="returnId" value={request.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <TextField id={`note-${request.id}`} label="Alasan penolakan" name="handlerNote" placeholder="Tulis alasan untuk pembeli" wrapperClassName="min-w-48 flex-1" />
                        <SubmitButton variant="danger">Tolak</SubmitButton>
                      </ActionForm>
                    </div>
                  )}

                  {request.status === 'APPROVED' && (
                    <ActionForm
                      action={handleReturnAction}
                      showSuccess={false}
                      confirmMessage={`Barang sudah sampai dan layak masuk stok? ${request.quantity} pasang akan ditambahkan kembali ke stok.`}
                    >
                      <input type="hidden" name="returnId" value={request.id} />
                      <input type="hidden" name="decision" value="RECEIVED" />
                      <SubmitButton>Barang sudah diterima toko</SubmitButton>
                    </ActionForm>
                  )}

                  {request.status === 'RECEIVED' && !canRefund && (
                    <p className="text-sm text-asphalt-500">Menunggu admin mengembalikan dana ke pembeli.</p>
                  )}

                  {request.status === 'RECEIVED' && canRefund && (
                    <ActionForm
                      action={handleReturnAction}
                      showSuccess={false}
                      confirmMessage={`Pastikan ${formatRupiah(refundValue)} benar-benar sudah dikembalikan ke pembeli. Tandai sudah direfund?`}
                    >
                      <input type="hidden" name="returnId" value={request.id} />
                      <input type="hidden" name="decision" value="REFUNDED" />
                      <SubmitButton>Dana sudah dikembalikan</SubmitButton>
                    </ActionForm>
                  )}
                </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <div className="mt-9">
          <Panel title="Sudah selesai">
          <ul className={`text-sm ${panelListClass}`}>
            {closed.map((request) => {
              const status = RETURN_STATUS[request.status];
              return (
                <li key={request.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="font-medium">
                      {request.orderItem.productName} uk. {request.orderItem.size} × {request.quantity}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {request.user.name}, order {request.orderItem.order.orderNumber}
                      {request.handledBy ? `, ditangani ${request.handledBy.name}` : ''}
                    </p>
                    {request.handlerNote && <p className="mt-1 text-xs">Catatan: {request.handlerNote}</p>}
                  </div>
                  <div className="text-right">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {request.status === 'REFUNDED' && <p className="tabular mt-1 text-xs">{formatRupiah(request.refundAmount ?? 0)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
