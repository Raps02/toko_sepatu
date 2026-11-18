import type { Metadata } from 'next';
import { DataTable } from '@/components/dashboard/DataTable';
import { EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Riwayat perubahan' };

const ACTION_LABEL: Record<string, string> = {
  'product.create': 'Menambah produk',
  'product.update': 'Mengubah produk',
  'product.delete': 'Menghapus produk',
  'product.image.add': 'Menambah foto produk',
  'product.image.delete': 'Menghapus foto produk',
  'variant.create': 'Menambah varian',
  'variant.activate': 'Mengaktifkan varian',
  'variant.deactivate': 'Menonaktifkan varian',
  'variant.delete': 'Menghapus varian',
  'price.update': 'Mengubah harga',
  'discount.create': 'Memasang diskon',
  'discount.end': 'Mengakhiri diskon',
  'stock.adjust': 'Mengoreksi stok',
  'approval.request': 'Mengajukan perubahan',
  'approval.approve': 'Menyetujui pengajuan',
  'approval.reject': 'Menolak pengajuan',
  'order.process': 'Memproses order',
  'order.ship': 'Mengirim order',
  'order.complete': 'Menyelesaikan order',
  'order.cancel': 'Membatalkan order',
  'order.correct': 'Mengoreksi data kirim order',
  'payment.late': 'Pembayaran masuk setelah order batal',
  'payment.refund': 'Menandai dana order sudah dikembalikan',
  'return.approve': 'Menyetujui retur',
  'return.reject': 'Menolak retur',
  'return.receive': 'Menerima barang retur',
  'return.refund': 'Menandai retur sudah direfund',
  'review.hide': 'Menyembunyikan review',
  'review.unhide': 'Menampilkan kembali review',
  'user.create': 'Membuat akun',
  'user.update': 'Mengubah akun',
  'user.delete': 'Menghapus akun',
  'shipping.update': 'Mengubah ongkir',
  'shipping.delete': 'Menghapus ongkir',
};

function describe(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, v]) => `${key}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');
}

export default async function AuditPage() {
  await requirePagePermission('audit.view');

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { name: true, role: true } } },
  });

  return (
    <>
      <PageHeader
        title="Riwayat perubahan"
        description="Log audit immutable: siapa mengubah harga, stok, order, atau akun beserta waktunya (200 catatan terakhir)."
      />

      {logs.length === 0 ? (
        <EmptyState title="Belum ada perubahan yang tercatat." />
      ) : (
        <DataTable
          caption="Riwayat perubahan"
          columns={[
            { key: 'time', label: 'Waktu', width: 150 },
            { key: 'actor', label: 'Oleh', width: 140 },
            { key: 'action', label: 'Tindakan' },
            { key: 'before', label: 'Sebelum' },
            { key: 'after', label: 'Sesudah' },
          ]}
          rows={logs.map((log) => {
            const actor = log.actor?.name ?? 'Otomatis';
            const action = ACTION_LABEL[log.action] ?? log.action;
            return {
              id: log.id,
              sort: { time: log.createdAt.getTime(), actor, action },
              cells: {
                time: <span className="text-xs text-ink-muted">{formatDateTime(log.createdAt)}</span>,
                actor,
                action,
                before: <span className="text-xs text-ink-muted">{describe(log.before)}</span>,
                after: <span className="text-xs">{describe(log.after)}</span>,
              },
            };
          })}
        />
      )}
    </>
  );
}
