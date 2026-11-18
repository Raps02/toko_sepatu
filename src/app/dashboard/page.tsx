import Link from 'next/link';
import { Boxes, ChevronRight, ClipboardCheck, MessageSquare, Plus, ShoppingCart, Star, Undo2 } from 'lucide-react';
import { BreakdownCard } from '@/components/dashboard/BreakdownCard';
import { GenderShare } from '@/components/dashboard/GenderShare';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { SalesTrend } from '@/components/dashboard/SalesTrend';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { buildDailySeries, shiftDateKey } from '@/lib/dashboard-stats';
import { dayRange, formatDate, formatDateTime, todayKey } from '@/lib/format';
import { ORDER_STATUS, REVENUE_STATUSES } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { unreadByStaff } from '@/lib/chat';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

const LOW_STOCK_THRESHOLD = 2;
/** 90 hari yang bisa dipilih + 90 hari pembandingnya. */
const SERIES_DAYS = 180;
const BREAKDOWN_DAYS = 30;
const GENDER_LABEL = { PRIA: 'Pria', WANITA: 'Wanita', UNISEX: 'Unisex' } as const;

export default async function DashboardHomePage() {
  const user = await requirePagePermission('dashboard.access');
  const today = todayKey();
  const reviewsApprovals = can(user.role, 'approval.review');
  // Angka uang lintas hari hanya untuk yang boleh melihat laporan rentang (admin).
  const showRevenue = can(user.role, 'report.finance.range');
  const { start: seriesStart, end: seriesEnd } = dayRange(shiftDateKey(today, -(SERIES_DAYS - 1)), today);
  const { start: breakdownStart } = dayRange(shiftDateKey(today, -(BREAKDOWN_DAYS - 1)));

  const [paid, processing, returns, approvals, unreadChats, unansweredReviews, lowStock, paidOrders, shippedOrders, soldItems, recentOrders] =
    await Promise.all([
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED'] } } }),
      prisma.changeRequest.count({
        where: { status: 'PENDING', ...(reviewsApprovals ? {} : { requestedById: user.id }) },
      }),
      prisma.conversation.count({ where: { OR: [{ needsStaff: true }, { messages: { some: unreadByStaff } }] } }),
      prisma.review.count({ where: { reply: null, isHidden: false } }),
      prisma.productVariant.count({
        where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD }, product: { isPublished: true } },
      }),
      prisma.order.findMany({
        where: { status: { in: REVENUE_STATUSES }, paidAt: { gte: seriesStart, lt: seriesEnd } },
        select: { paidAt: true, total: true, items: { select: { quantity: true } } },
      }),
      prisma.order.findMany({
        where: { shippedAt: { gte: seriesStart, lt: seriesEnd } },
        select: { shippedAt: true },
      }),
      prisma.orderItem.findMany({
        where: { order: { status: { in: REVENUE_STATUSES }, paidAt: { gte: breakdownStart, lt: seriesEnd } } },
        select: { productName: true, size: true, quantity: true, variant: { select: { product: { select: { gender: true } } } } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, user: { select: { name: true } } },
      }),
    ]);

  const series = buildDailySeries(
    paidOrders.map((o) => ({ paidAt: o.paidAt!, total: o.total, pairs: o.items.reduce((n, i) => n + i.quantity, 0) })),
    shippedOrders.map((o) => ({ shippedAt: o.shippedAt! })),
    today,
    SERIES_DAYS,
  ).map((day) => (showRevenue ? day : { ...day, revenue: 0 }));

  const tally = (pick: (item: (typeof soldItems)[number]) => string) => {
    const totals = new Map<string, number>();
    for (const item of soldItems) totals.set(pick(item), (totals.get(pick(item)) ?? 0) + item.quantity);
    return [...totals].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);
  };
  const byProduct = tally((item) => item.productName).slice(0, 6);
  const bySize = tally((item) => `Ukuran ${item.size}`).slice(0, 6);
  const byGender = tally((item) => GENDER_LABEL[item.variant.product.gender]);

  const queue = [
    { count: paid, label: 'Order dibayar, belum disiapkan', href: '/dashboard/orders?status=PAID', icon: ShoppingCart, urgent: true },
    { count: processing, label: 'Order disiapkan, siap dikirim', href: '/dashboard/orders?status=PROCESSING', icon: ShoppingCart, urgent: true },
    { count: returns, label: 'Pengajuan retur', href: '/dashboard/returns', icon: Undo2, urgent: true },
    {
      count: approvals,
      label: reviewsApprovals ? 'Pengajuan SPV menunggu keputusanmu' : 'Pengajuanmu menunggu keputusan admin',
      href: '/dashboard/approvals',
      icon: ClipboardCheck,
      urgent: reviewsApprovals,
    },
    { count: unreadChats, label: 'Chat pembeli belum dibalas', href: '/dashboard/chat', icon: MessageSquare, urgent: false },
    { count: unansweredReviews, label: 'Review belum dibalas', href: '/dashboard/reviews', icon: Star, urgent: false },
    { count: lowStock, label: `Varian dengan stok ${LOW_STOCK_THRESHOLD} pasang atau kurang`, href: '/dashboard/stock?filter=low', icon: Boxes, urgent: false },
  ].filter((item) => item.count > 0);

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name.split(' ')[0]}`}
        description={`Keadaan toko per ${formatDate(new Date())}. Angka penjualan dihitung dari order yang sudah dibayar.`}
        actions={
          <>
            <ButtonLink href="/dashboard/orders" variant="secondary" size="sm">
              Kelola order
            </ButtonLink>
            <ButtonLink href="/dashboard/products/new" variant="primary" size="sm">
              <Plus className="h-4 w-4" aria-hidden />
              Tambah produk
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4">
        <SalesTrend series={series} showRevenue={showRevenue} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <Panel title="Perlu ditangani" aside={<Badge>{queue.length} antrean</Badge>} className="h-full">
              {queue.length === 0 ? (
                <EmptyState title="Semua antrean beres" hint="Tidak ada order, retur, atau pesan yang menunggu." />
              ) : (
                <ul className="-mx-2 -mb-2">
                  {queue.map(({ count, label, href, icon: Icon, urgent }) => (
                    <li key={href}>
                      <Link href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-pavement">
                        <Icon className={`h-4 w-4 shrink-0 ${urgent ? 'text-ink' : 'text-ink-muted'}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
                        <Badge tone={urgent ? 'warn' : 'neutral'}>{count}</Badge>
                        <ChevronRight className="h-4 w-4 text-asphalt-300 group-hover:text-ink" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <BreakdownCard
            title="Terlaris"
            note="Pasang terjual, 30 hari terakhir"
            views={[
              { value: 'produk', label: 'Produk', rows: byProduct, valueLabel: 'Pasang' },
              { value: 'ukuran', label: 'Ukuran', rows: bySize, valueLabel: 'Pasang' },
            ]}
            empty="Belum ada pasang terjual dalam 30 hari terakhir."
          />

          <GenderShare data={byGender.map(({ key, label, value }) => ({ key, label, value }))} />
        </div>

        <Panel
          title="Order terbaru"
          aside={
            <ButtonLink href="/dashboard/orders?status=all" variant="ghost" size="sm">
              Lihat semua order
            </ButtonLink>
          }
        >
          <RecentOrdersTable
              rows={recentOrders.map((order) => ({
                id: order.id,
                orderNumber: order.orderNumber,
                buyer: order.user.name,
                createdAt: order.createdAt.getTime(),
                createdLabel: formatDateTime(order.createdAt),
                statusLabel: ORDER_STATUS[order.status].label,
                statusTone: ORDER_STATUS[order.status].tone,
                total: order.total,
              }))}
            />
        </Panel>
      </div>
    </>
  );
}
