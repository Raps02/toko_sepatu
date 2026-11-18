import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { syncPendingMidtransOrders } from '@/lib/midtrans-sync';
import { expireStaleOrders, ORDER_STATUS } from '@/lib/orders';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pesanan saya' };

export default async function OrdersPage() {
  const user = await requirePagePermission('shop.buy');
  await expireStaleOrders();
  await syncPendingMidtransOrders(user.id);

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { productName: true, size: true, quantity: true } } },
  });

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="sr-only">Pesanan saya</h1>
        <EmptyState
          title="Belum Ada Pesanan"
          hint="Pesanan yang kamu buat akan muncul di sini beserta status pengirimannya."
          action={
            <ButtonLink href="/products" variant="primary" pill>
              Lihat Semua Sepatu
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Pesanan Saya</h1>
      <ul className="mt-6 space-y-3">
        {orders.map((order) => {
          const status = ORDER_STATUS[order.status];
          return (
            <li key={order.id}>
              <Panel
                title={
                  <Link href={`/orders/${order.id}`} className="tabular after:absolute after:inset-0">
                    {order.orderNumber}
                  </Link>
                }
                aside={<Badge tone={status.tone}>{status.label}</Badge>}
                description={order.items.map((item) => `${item.productName} ukuran ${item.size} × ${item.quantity}`).join(', ')}
              >
                <p className="tabular text-sm text-ink-muted">
                  {formatDateTime(order.createdAt)}, total <span className="font-medium text-ink">{formatRupiah(order.total)}</span>
                </p>
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
