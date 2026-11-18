import { dateKey, dayRange } from '@/lib/format';
import { REVENUE_STATUSES } from '@/lib/orders';
import { prisma } from '@/lib/prisma';

// Laporan keuangan dihitung langsung dari order dan retur; tidak ada angka
// yang diinput manual. Sebuah order masuk ke tanggal pembayarannya (WIB).
// Order yang dibatalkan tidak dihitung sama sekali.

export type FinanceFigures = {
  orders: number;
  pairsSold: number;
  /** Harga barang sebelum diskon. */
  grossSales: number;
  discounts: number;
  /** Harga barang setelah diskon. */
  netSales: number;
  /** Ongkir yang dibayar pembeli; diteruskan ke kurir, bukan pendapatan toko. */
  shipping: number;
  /** Uang yang benar-benar masuk dari pembeli. */
  received: number;
  /** Harga modal barang yang terjual. */
  costOfGoods: number;
  /** Dana yang dikembalikan lewat retur pada periode ini. */
  refunds: number;
  /** Harga modal barang retur yang kembali ke stok. */
  returnedCost: number;
  grossProfit: number;
};

const empty = (): FinanceFigures => ({
  orders: 0,
  pairsSold: 0,
  grossSales: 0,
  discounts: 0,
  netSales: 0,
  shipping: 0,
  received: 0,
  costOfGoods: 0,
  refunds: 0,
  returnedCost: 0,
  grossProfit: 0,
});

function finalize(figures: FinanceFigures): FinanceFigures {
  figures.netSales = figures.grossSales - figures.discounts;
  figures.grossProfit = figures.netSales - figures.refunds - (figures.costOfGoods - figures.returnedCost);
  return figures;
}

export async function financeReport(from: string, to: string = from) {
  const { start, end } = dayRange(from, to);

  const [orders, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { gte: start, lt: end }, status: { in: REVENUE_STATUSES } },
      orderBy: { paidAt: 'asc' },
      include: {
        items: { select: { quantity: true, unitCost: true } },
        user: { select: { name: true } },
        payment: { select: { method: true } },
      },
    }),
    prisma.returnRequest.findMany({
      where: { status: 'REFUNDED', refundedAt: { gte: start, lt: end } },
      orderBy: { refundedAt: 'asc' },
      include: {
        orderItem: { select: { unitCost: true, productName: true, size: true, order: { select: { orderNumber: true } } } },
      },
    }),
  ]);

  const days = new Map<string, FinanceFigures>();
  const dayOf = (key: string) => {
    let figures = days.get(key);
    if (!figures) {
      figures = empty();
      days.set(key, figures);
    }
    return figures;
  };
  const totals = empty();

  for (const order of orders) {
    const pairs = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const cost = order.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    for (const figures of [totals, dayOf(dateKey(order.paidAt ?? order.createdAt))]) {
      figures.orders += 1;
      figures.pairsSold += pairs;
      figures.grossSales += order.subtotal;
      figures.discounts += order.discountTotal;
      figures.shipping += order.shippingCost;
      figures.received += order.total;
      figures.costOfGoods += cost;
    }
  }

  for (const refund of refunds) {
    const amount = refund.refundAmount ?? 0;
    const cost = refund.orderItem.unitCost * refund.quantity;
    for (const figures of [totals, dayOf(dateKey(refund.refundedAt ?? refund.updatedAt))]) {
      figures.refunds += amount;
      figures.returnedCost += cost;
    }
  }

  finalize(totals);
  const daily = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, figures]) => ({ date, ...finalize(figures) }));

  return { from, to, totals, daily, orders, refunds };
}

export type FinanceReport = Awaited<ReturnType<typeof financeReport>>;

/** Ringkasan rating per produk untuk laporan review. */
export async function ratingReport() {
  const [grouped, products] = await Promise.all([
    prisma.review.groupBy({ by: ['productId', 'rating'], where: { isHidden: false }, _count: true }),
    prisma.product.findMany({ select: { id: true, name: true, brand: true } }),
  ]);

  const names = new Map(products.map((p) => [p.id, p]));
  const summary = new Map<string, { count: number; sum: number; distribution: [number, number, number, number, number] }>();
  for (const row of grouped) {
    const entry = summary.get(row.productId) ?? { count: 0, sum: 0, distribution: [0, 0, 0, 0, 0] };
    entry.count += row._count;
    entry.sum += row.rating * row._count;
    if (row.rating >= 1 && row.rating <= 5) entry.distribution[row.rating - 1] += row._count;
    summary.set(row.productId, entry);
  }

  return [...summary.entries()]
    .map(([productId, entry]) => ({
      productId,
      name: names.get(productId)?.name ?? 'Produk dihapus',
      brand: names.get(productId)?.brand ?? '',
      count: entry.count,
      average: entry.sum / entry.count,
      lowRatings: entry.distribution[0] + entry.distribution[1],
      distribution: entry.distribution,
    }))
    .sort((a, b) => a.average - b.average);
}
