import type { Metadata } from 'next';
import type { ChangeRequestStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { cancelChangeRequestAction, reviewChangeRequestAction } from '@/actions/approval.actions';
import { Badge, EmptyState, PageHeader, type Tone } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { CHANGE_TYPE_LABEL } from '@/lib/change-requests';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Persetujuan' };

const STATUS: Record<ChangeRequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu', tone: 'warn' },
  APPROVED: { label: 'Disetujui', tone: 'good' },
  REJECTED: { label: 'Ditolak', tone: 'bad' },
};

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const reviewer = can(user.role, 'approval.review');
  if (!reviewer && !can(user.role, 'approval.request')) redirect('/');

  // Admin melihat semua pengajuan; SPV hanya melihat pengajuannya sendiri.
  const requests = await prisma.changeRequest.findMany({
    where: reviewer ? {} : { requestedById: user.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
  });
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');

  return (
    <>
      <PageHeader
        title="Persetujuan perubahan"
        description={
          reviewer
            ? 'Tinjau pengajuan harga, diskon, koreksi stok, dan koreksi pengiriman dari supervisor. Perubahan yang disetujui langsung aktif.'
            : 'Daftar pengajuanmu ke admin. Perubahan baru diterapkan di toko setelah admin menyetujuinya.'
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Menunggu keputusan</h2>
        <Badge tone={pending.length > 0 ? 'warn' : 'neutral'}>{pending.length} menunggu</Badge>
      </div>

      {pending.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan yang menunggu." hint={reviewer ? 'Semua pengajuan supervisor sudah diputuskan.' : 'Pengajuan harga, diskon, atau koreksi akan muncul di sini.'} />
      ) : (
        <ul className="space-y-4">
          {pending.map((request) => (
            <li key={request.id}>
              <Panel title={request.summary} aside={<Badge tone="dark">{CHANGE_TYPE_LABEL[request.type]}</Badge>}>
              <p className="text-xs text-ink-muted">
                Diajukan oleh <span className="font-medium text-ink">{request.requestedBy.name}</span>, {formatDateTime(request.createdAt)}
              </p>
              <p className="mt-2 rounded-lg bg-pavement px-3 py-2 text-sm text-ink-muted">
                <span className="font-medium text-ink">Alasan:</span> {request.reason}
              </p>
              {!reviewer && (
                <div className="mt-3">
                  <ActionForm action={cancelChangeRequestAction.bind(null, request.id)} confirmTone="danger" confirmLabel="Ya, batalkan" confirmMessage="Batalkan pengajuan ini?">
                    <SubmitButton variant="ghost" size="sm">
                      Batalkan pengajuan
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}

              {reviewer && (
                <div className="mt-4 grid gap-3 border-t border-studio-line pt-4 sm:grid-cols-[auto_1fr]">
                  <ActionForm action={reviewChangeRequestAction} showSuccess={false}>
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <SubmitButton pendingLabel="Menerapkan…">Setujui dan terapkan</SubmitButton>
                  </ActionForm>
                  <ActionForm action={reviewChangeRequestAction} showSuccess={false} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <TextField id={`note-${request.id}`} label="Alasan penolakan" name="reviewNote" placeholder="Tulis alasan untuk supervisor" wrapperClassName="min-w-48 flex-1" />
                    <SubmitButton variant="danger">Tolak</SubmitButton>
                  </ActionForm>
                </div>
              )}
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <section className="mt-10">
          <Panel title="Riwayat keputusan">
          <ul className={panelListClass}>
            {decided.map((request) => (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
                <div>
                  <p className="font-medium text-ink">{request.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {CHANGE_TYPE_LABEL[request.type]}, diajukan {request.requestedBy.name}
                    {request.reviewedAt && `, diputuskan ${request.reviewedBy?.name ?? 'admin'} ${formatDateTime(request.reviewedAt)}`}
                  </p>
                  {request.reviewNote && <p className="mt-1.5 text-xs text-ink">Catatan admin: {request.reviewNote}</p>}
                </div>
                <Badge tone={STATUS[request.status].tone}>{STATUS[request.status].label}</Badge>
              </li>
            ))}
          </ul>
          </Panel>
        </section>
      )}
    </>
  );
}
