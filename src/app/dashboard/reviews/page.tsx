import type { Metadata } from 'next';
import { replyReviewAction, setReviewHiddenAction } from '@/actions/service.actions';
import { DataTable } from '@/components/dashboard/DataTable';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { Stars } from '@/components/shop/Stars';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextAreaField } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { ratingReport } from '@/lib/reports';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Review' };

export default async function ReviewsPage() {
  const user = await requirePagePermission('review.reply');
  const canModerate = can(user.role, 'review.moderate');
  const seesReport = can(user.role, 'report.rating');

  const [reviews, report] = await Promise.all([
    prisma.review.findMany({
      // Yang belum dibalas tampil dulu.
      orderBy: [{ repliedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: 100,
      include: {
        user: { select: { name: true } },
        product: { select: { name: true } },
        orderItem: { select: { size: true, color: true } },
        repliedBy: { select: { name: true } },
      },
    }),
    seesReport ? ratingReport() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Review dan rating" description="Ulasan dari pembeli yang pesanannya sudah sampai. Balasanmu tampil di halaman produk." />

      {seesReport && report.length > 0 && (
        <section className="mb-9">
          <h2 className="mb-1 text-base font-bold text-ink">Laporan rating per produk</h2>
          <p className="mb-3 text-xs text-ink-muted">Diurutkan dari rating terendah agar produk bermasalah segera terlihat.</p>
          <DataTable
            caption="Laporan rating per produk"
            columns={[
              { key: 'product', label: 'Produk' },
              { key: 'average', label: 'Rata-rata' },
              { key: 'count', label: 'Jumlah review', numeric: true },
              { key: 'low', label: 'Bintang 1 dan 2', numeric: true },
              { key: 'spread', label: 'Sebaran bintang 1 sampai 5' },
            ]}
            rows={report.map((row) => ({
              id: row.productId,
              sort: { product: row.name, average: row.average, count: row.count, low: row.lowRatings },
              cells: {
                product: (
                  <>
                    <span className="font-medium">{row.name}</span>
                    <p className="text-xs text-ink-muted">{row.brand}</p>
                  </>
                ),
                average: (
                  <span className="flex items-center gap-2">
                    <Stars value={row.average} />
                    {row.average.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                  </span>
                ),
                count: row.count,
                low: <span className={row.lowRatings > 0 ? 'text-danger' : undefined}>{row.lowRatings}</span>,
                spread: <span className="text-xs text-ink-muted">{row.distribution.join(' / ')}</span>,
              },
            }))}
          />
        </section>
      )}

      <h2 className="mb-3 text-base font-bold text-ink">Semua review</h2>
      {reviews.length === 0 ? (
        <EmptyState title="Belum ada review." hint="Review muncul setelah pembeli menerima pesanannya dan menulis ulasan." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className={review.isHidden ? 'opacity-70' : undefined}>
              <Panel
                title={review.product.name}
                aside={
                  <>
                    <Stars value={review.rating} />
                    {review.isHidden && <Badge tone="bad">Disembunyikan</Badge>}
                  </>
                }
                description={`${review.user.name}, ukuran ${review.orderItem.size} ${review.orderItem.color}, ${formatDateTime(review.createdAt)}`}
              >
              <p className="whitespace-pre-line text-sm">{review.comment ?? <span className="text-ink-muted">Tanpa ulasan tertulis.</span>}</p>

              {review.reply && (
                <div className="mt-3 border-l-2 border-ink pl-3 text-sm">
                  <p className="text-xs font-medium text-ink">
                    Balasan toko{review.repliedBy ? ` oleh ${review.repliedBy.name}` : ''}
                  </p>
                  <p className="whitespace-pre-line text-ink-muted">{review.reply}</p>
                </div>
              )}

              <div className="mt-3">
                <Disclosure title={review.reply ? 'Ubah balasan' : 'Balas review ini'} defaultOpen={!review.reply}>
                  <ActionForm action={replyReviewAction} showSuccess={false} className="space-y-2">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <TextAreaField
                      id={`reply-${review.id}`}
                      label="Balasan"
                      name="reply"
                      rows={2}
                      required
                      defaultValue={review.reply ?? ''}
                      placeholder="Tulis balasan untuk pembeli"
                    />
                    <SubmitButton variant="secondary">{review.reply ? 'Simpan balasan' : 'Kirim balasan'}</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
              {canModerate && (
                <div className="mt-3">
                  <ActionForm
                    action={setReviewHiddenAction.bind(null, review.id, !review.isHidden)}
                    showSuccess={false}
                    confirmMessage={review.isHidden ? undefined : 'Sembunyikan review ini dari halaman produk? Gunakan hanya untuk spam atau kata-kata kasar.'}
                  >
                    <SubmitButton variant="ghost" size="sm">
                      {review.isHidden ? 'Tampilkan lagi' : 'Sembunyikan'}
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
