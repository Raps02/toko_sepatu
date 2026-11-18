import type { Metadata } from 'next';
import type { OrderStatus } from '@prisma/client';
import Link from 'next/link';
import { DataTable } from '@/components/dashboard/DataTable';
import { LinkSegments } from '@/components/dashboard/LinkSegments';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { syncPendingMidtransOrders } from '@/lib/midtrans-sync';
import { expireStaleOrders, ORDER_STATUS } from '@/lib/orders';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Order' };

const TABS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'todo', label: 'Perlu ditangani', statuses: ['PAID', 'PROCESSING'] },
  { key: 'PENDING_PAYMENT', label: 'Menunggu pembayaran', statuses: ['PENDING_PAYMENT'] },
  { key: 'SHIPPED', label: 'Dalam pengiriman', statuses: ['SHIPPED'] },
  { key: 'COMPLETED', label: 'Selesai', statuses: ['COMPLETED'] },
  { key: 'closed', label: 'Batal', statuses: ['CANCELLED', 'EXPIRED'] },
  { key: 'all', label: 'Semua' },
];

export default async function DashboardOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission('order.process');
  await expireStaleOrders();
  await syncPendingMidtransOrders();

  const { status } = await searchParams;
  // Tautan dari halaman ringkasan memakai nama status langsung (PAID, PROCESSING).
  const direct = status && status in ORDER_STATUS ? (status as OrderStatus) : null;
  const tab = TABS.find((t) => t.key === status) ?? (direct ? null : TABS[0]);
  const statuses = direct && !tab ? [direct] : tab?.statuses;

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where: statuses ? { status: { in: statuses } } : {},
      // Yang perlu ditangani: paling lama dibayar tampil paling atas.
      orderBy: tab?.key === 'todo' ? { paidAt: 'asc' } : { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true } },
        items: { select: { quantity: true } },
        payment: { select: { status: true } },
      },
    }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));
  const totalOrders = counts.reduce((sum, c) => sum + c._count, 0);

  function tabCount(item: (typeof TABS)[number]): number {
    if (!item.statuses) return totalOrders;
    return item.statuses.reduce((sum, st) => sum + (countByStatus.get(st) ?? 0), 0);
  }

  return (
    <>
      <PageHeader
        title="Order masuk"
        description="Siapkan barang yang sudah dibayar, isi kurir dan nomor resi, lalu pantau pengirimannya."
      />

      <div className="mb-5">
        <LinkSegments
          label="Saring order"
          active={tab ? `/dashboard/orders?status=${tab.key}` : ''}
          options={TABS.map((item) => ({ href: `/dashboard/orders?status=${item.key}`, label: item.label, count: tabCount(item) }))}
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={tab?.key === 'todo' ? 'Tidak ada order yang menunggu ditangani.' : 'Tidak ada order di kelompok ini.'}
          hint="Order baru muncul di sini begitu pembeli selesai membayar."
        />
      ) : (
        <DataTable
          caption="Daftar order"
          columns={[
            { key: 'order', label: 'Order' },
            { key: 'buyer', label: 'Pembeli' },
            { key: 'city', label: 'Tujuan' },
            { key: 'pairs', label: 'Pasang', numeric: true },
            { key: 'total', label: 'Total', numeric: true },
            { key: 'status', label: 'Status' },
          ]}
          rows={orders.map((order) => {
            const info = ORDER_STATUS[order.status];
            const refundDue = (order.status === 'CANCELLED' || order.status === 'EXPIRED') && order.payment?.status === 'PAID';
            const pairs = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return {
              id: order.id,
              sort: { order: order.createdAt.getTime(), buyer: order.user.name, city: order.shipCity, pairs, total: order.total, status: info.label },
              cells: {
                order: (
                  <>
                    <Link href={`/dashboard/orders/${order.id}`} className="font-medium text-ink hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-ink-muted">{formatDateTime(order.createdAt)}</p>
                  </>
                ),
                buyer: order.user.name,
                city: (
                  <>
                    {order.shipCity}
                    <p className="text-xs text-ink-muted">{order.shipProvince}</p>
                  </>
                ),
                pairs,
                total: formatRupiah(order.total),
                status: (
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={info.tone}>{info.label}</Badge>
                    {refundDue && <Badge tone="warn">Dana perlu dikembalikan</Badge>}
                  </div>
                ),
              },
            };
          })}
        />
      )}
    </>
  );
}
