import type { Metadata } from 'next';
import Link from 'next/link';
import { MetricCard } from '@/components/arc/metric-card/metric-card';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { ReportActions } from '@/components/dashboard/ReportActions';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/Field';
import { formatDate, formatDateTime, formatRupiah, isDateKey, todayKey } from '@/lib/format';
import { can } from '@/lib/permissions';
import { financeReport } from '@/lib/reports';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Laporan keuangan' };

const MAX_RANGE_DAYS = 366;
const asDate = (key: string) => new Date(`${key}T12:00:00+07:00`);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; date?: string }> }) {
  const user = await requirePagePermission('report.finance.daily');
  const params = await searchParams;
  const canRange = can(user.role, 'report.finance.range');
  // Modal dan laba kotor hanya untuk admin; SPV melihat penjualan, volume, dan uang masuk.
  const seesCost = can(user.role, 'cost.view');
  const today = todayKey();

  // SPV hanya boleh melihat satu hari. Batas ini ditegakkan di server:
  // parameter `from`/`to` diabaikan untuk role yang tidak punya izin rentang.
  let from: string;
  let to: string;
  if (canRange) {
    from = isDateKey(params.from) ? params.from : today;
    to = isDateKey(params.to) ? params.to : from;
    if (to < from) [from, to] = [to, from];
    const span = (asDate(to).getTime() - asDate(from).getTime()) / 86_400_000;
    if (span > MAX_RANGE_DAYS) to = from;
  } else {
    from = isDateKey(params.date) ? params.date : today;
    to = from;
  }

  const report = await financeReport(from, to);
  const { totals } = report;
  const singleDay = from === to;
  const period = singleDay ? formatDate(asDate(from)) : `${formatDate(asDate(from))} s.d. ${formatDate(asDate(to))}`;

  const lines: { label: string; value: number; note?: string; strong?: boolean; negative?: boolean }[] = [
    { label: 'Penjualan kotor', value: totals.grossSales, note: 'Harga barang sebelum diskon' },
    { label: 'Diskon', value: totals.discounts, negative: true },
    { label: 'Penjualan bersih', value: totals.netSales, strong: true },
    { label: 'Pengembalian dana retur', value: totals.refunds, negative: true },
    ...(seesCost
      ? [
          { label: 'Harga modal barang terjual', value: totals.costOfGoods - totals.returnedCost, negative: true, note: 'Sudah dikurangi modal barang retur yang kembali ke stok' },
          { label: 'Laba kotor', value: totals.grossProfit, strong: true },
        ]
      : []),
  ];

  const csvRows: (string | number)[][] = [
    ['Tanggal', 'Order', 'Pasang terjual', 'Penjualan kotor', 'Diskon', 'Penjualan bersih', 'Ongkir', 'Uang diterima', 'Harga modal', 'Refund retur', 'Laba kotor'],
    ...report.daily.map((d) => [d.date, d.orders, d.pairsSold, d.grossSales, d.discounts, d.netSales, d.shipping, d.received, d.costOfGoods - d.returnedCost, d.refunds, d.grossProfit]),
    ['Total', totals.orders, totals.pairsSold, totals.grossSales, totals.discounts, totals.netSales, totals.shipping, totals.received, totals.costOfGoods - totals.returnedCost, totals.refunds, totals.grossProfit],
  ];

  return (
    <>
      <PageHeader
        tag={canRange ? undefined : 'Mode harian'}
        title="Laporan keuangan"
        description={
          canRange
            ? 'Dihitung otomatis dari order yang sudah dibayar dan retur yang sudah direfund. Tidak ada angka yang diinput manual.'
            : 'Laporan harian hanya-baca untuk supervisor. Koreksi order atau stok diajukan melalui menu Order atau Stok.'
        }
        actions={<ReportActions csvRows={canRange ? csvRows : undefined} filename={`laporan-keuangan-${from}${singleDay ? '' : `-sd-${to}`}.csv`} />}
      />

      <div className="mb-7 print:hidden">
        <Panel title="Periode laporan" aside={<Badge tone={canRange ? 'good' : 'warn'}>{period}</Badge>}>
          <form className="flex flex-wrap items-end gap-4">
            {canRange ? (
              <>
                <DateField label="Dari tanggal" name="from" wrapperClassName="w-56" defaultValue={from} max={today} />
                <DateField label="Sampai tanggal" name="to" wrapperClassName="w-56" defaultValue={to} max={today} />
              </>
            ) : (
              <DateField label="Tanggal laporan" name="date" wrapperClassName="w-56" defaultValue={from} max={today} />
            )}
            <Button type="submit">Tampilkan</Button>
          </form>
        </Panel>
      </div>

      {/* 4 Financial KPI Cards */}
      <section aria-label="Ringkasan periode" className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${seesCost ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <MetricCard label="Penjualan bersih" prefix={'Rp\u00a0'} value={totals.netSales} context={`Kotor ${formatRupiah(totals.grossSales)}`} />
        {seesCost && <MetricCard label="Laba kotor" prefix={'Rp\u00a0'} value={totals.grossProfit} context="Setelah modal dan refund retur" />}
        <MetricCard label="Sepatu terjual" value={totals.pairsSold} suffix=" pasang" context={`Dari ${totals.orders} order dibayar`} />
        <MetricCard label="Uang masuk" prefix={'Rp\u00a0'} value={totals.received} context={`Termasuk ongkir ${formatRupiah(totals.shipping)}`} />
      </section>

      <div className="mt-7 max-w-2xl">
        <Panel title={seesCost ? `Rincian laba rugi (${period})` : `Rincian penjualan (${period})`}>
          <dl className={`tabular ${panelListClass}`}>
            {lines.map((line) => (
              <div key={line.label} className={`flex items-baseline justify-between gap-4 px-5 py-3 text-sm ${line.strong ? 'bg-pavement/60 font-medium' : ''}`}>
                <dt>
                  {line.label}
                  {line.note && <span className="block text-xs font-normal text-ink-muted">{line.note}</span>}
                </dt>
                <dd>
                  {line.negative && line.value > 0 ? '-' : ''}
                  {formatRupiah(line.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {!singleDay && report.daily.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold text-ink">Rekap per hari</h2>
          <DataTable
            caption="Rekap per hari"
            columns={[
              { key: 'date', label: 'Tanggal' },
              { key: 'orders', label: 'Order', numeric: true },
              { key: 'net', label: 'Penjualan bersih', numeric: true },
              ...(seesCost ? [{ key: 'cost', label: 'Harga modal', numeric: true }] : []),
              { key: 'refunds', label: 'Refund retur', numeric: true },
              ...(seesCost ? [{ key: 'profit', label: 'Laba kotor', numeric: true }] : []),
            ]}
            rows={report.daily.map((day) => ({
              id: day.date,
              sort: { date: day.date, orders: day.orders, net: day.netSales, cost: day.costOfGoods - day.returnedCost, refunds: day.refunds, profit: day.grossProfit },
              cells: {
                date: formatDate(asDate(day.date)),
                orders: day.orders,
                net: formatRupiah(day.netSales),
                cost: formatRupiah(day.costOfGoods - day.returnedCost),
                refunds: formatRupiah(day.refunds),
                profit: formatRupiah(day.grossProfit),
              },
            }))}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold text-ink">Order yang dibayar</h2>
        {report.orders.length === 0 ? (
          <EmptyState title="Tidak ada order yang dibayar pada periode ini." hint="Pilih tanggal lain untuk melihat penjualan." />
        ) : (
          <DataTable
            caption="Order yang dibayar"
            columns={[
              { key: 'paid', label: 'Dibayar' },
              { key: 'order', label: 'Order' },
              { key: 'buyer', label: 'Pembeli' },
              { key: 'method', label: 'Metode' },
              { key: 'items', label: 'Barang', numeric: true },
              { key: 'shipping', label: 'Ongkir', numeric: true },
              { key: 'total', label: 'Total', numeric: true },
            ]}
            rows={report.orders.map((order) => ({
              id: order.id,
              sort: { paid: order.paidAt?.getTime() ?? 0, order: order.orderNumber, buyer: order.user.name, items: order.subtotal - order.discountTotal, shipping: order.shippingCost, total: order.total },
              cells: {
                paid: <span className="text-xs text-ink-muted">{order.paidAt && formatDateTime(order.paidAt)}</span>,
                order: (
                  <Link href={`/dashboard/orders/${order.id}`} className="font-medium text-ink hover:underline">
                    {order.orderNumber}
                  </Link>
                ),
                buyer: order.user.name,
                method: <span className="text-xs text-ink-muted">{order.payment?.method?.replace(/_/g, ' ') ?? '-'}</span>,
                items: formatRupiah(order.subtotal - order.discountTotal),
                shipping: formatRupiah(order.shippingCost),
                total: formatRupiah(order.total),
              },
            }))}
          />
        )}
      </section>

      {report.refunds.length > 0 && (
        <div className="mt-8">
          <Panel title="Retur yang direfund">
            <ul className={`tabular text-sm ${panelListClass}`}>
              {report.refunds.map((refund) => (
                <li key={refund.id} className="flex flex-wrap justify-between gap-3 px-5 py-3">
                  <span>
                    {refund.orderItem.productName} uk. {refund.orderItem.size} × {refund.quantity}
                    <span className="text-ink-muted">, order {refund.orderItem.order.orderNumber}</span>
                  </span>
                  <span className="font-medium text-danger">-{formatRupiah(refund.refundAmount ?? 0)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
