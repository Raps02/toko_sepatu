'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter';
import { LineChart, type LineChartDatum } from '@/components/arc/line-chart/line-chart';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { changeText, type DayStat } from '@/lib/dashboard-stats';
import { formatRupiah } from '@/lib/format';

type MetricKey = 'revenue' | 'orders' | 'pairs' | 'shipped';

const METRICS: Record<MetricKey, { label: string; unit: string; money?: boolean }> = {
  revenue: { label: 'Penjualan', unit: '', money: true },
  orders: { label: 'Order dibayar', unit: 'order' },
  pairs: { label: 'Pasang terjual', unit: 'pasang' },
  shipped: { label: 'Order dikirim', unit: 'order' },
};

const RANGES = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
];

const compactRupiah = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
const axisLabel = (key: string) =>
  new Date(`${key}T12:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

/**
 * Kartu tren di ringkasan: angka utama sebagai tab di atas satu grafik.
 * `series` berisi 180 hari (90 hari ini + 90 hari pembanding), urut dari yang terlama.
 * SPV tidak mendapat data uang (`showRevenue` false), jadi tab Penjualan tidak ada.
 */
export function SalesTrend({ series, showRevenue }: { series: DayStat[]; showRevenue: boolean }) {
  const metrics = (Object.keys(METRICS) as MetricKey[]).filter((key) => showRevenue || key !== 'revenue');
  const [range, setRange] = useState('30');
  const [metric, setMetric] = useState<MetricKey>(metrics[0]!);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const days = Number(range);
  const current = series.slice(-days);
  const previous = series.slice(-days * 2, -days);

  const totals = useMemo(() => {
    const sum = (rows: DayStat[], key: MetricKey) => rows.reduce((acc, row) => acc + row[key], 0);
    return Object.fromEntries(metrics.map((key) => [key, { now: sum(current, key), before: sum(previous, key) }])) as Record<
      MetricKey,
      { now: number; before: number }
    >;
  }, [current, previous, metrics]);

  const info = METRICS[metric];
  const data: LineChartDatum[] = current.map((day, index) => ({
    key: day.key,
    label: dayLabel(day.key),
    axisLabel: axisLabel(day.key),
    values: { now: day[metric], before: previous[index]?.[metric] ?? 0 },
  }));

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? metrics.length - 1 : null;
    if (!step && jump === null) return;
    event.preventDefault();
    const next = jump ?? (index + step + metrics.length) % metrics.length;
    setMetric(metrics[next]!);
    tabs.current[next]?.focus();
  }

  return (
    <section aria-labelledby="tren-judul" className="overflow-hidden rounded-2xl border border-studio-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-4 sm:px-6">
        <h2 id="tren-judul" className="text-base font-semibold text-ink">
          Tren penjualan
        </h2>
        <SegmentedControl label="Rentang waktu" options={RANGES} value={range} onValueChange={setRange} />
      </div>

      <div
        role="tablist"
        aria-label="Angka utama"
        className={`grid grid-cols-2 border-b border-studio-line ${metrics.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
      >
        {metrics.map((key, index) => {
          const selected = key === metric;
          const { now, before } = totals[key];
          const change = changeText(now, before);
          const down = change?.startsWith('−');
          return (
            <button
              key={key}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={selected}
              aria-controls="tren-grafik"
              tabIndex={selected ? 0 : -1}
              onClick={() => setMetric(key)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={`relative min-w-0 px-5 py-4 text-left transition-colors sm:px-6 ${
                selected ? 'bg-white' : 'bg-pavement/60 hover:bg-pavement'
              } ${index > 0 ? 'border-l border-studio-line' : ''} ${index === 2 ? 'max-lg:border-l-0' : ''} ${
                index > 1 ? 'max-lg:border-t' : ''
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-[3px] transition-colors ${selected ? 'bg-court' : 'bg-transparent'}`}
              />
              <span className={`block text-sm ${selected ? 'font-medium text-ink' : 'text-ink-muted'}`}>{METRICS[key].label}</span>
              <span className="mt-1 block truncate font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2rem]">
                <AnimatedCounter value={now} prefix={METRICS[key].money ? 'Rp ' : ''} />
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {change === null ? (
                  'Belum ada pembanding'
                ) : (
                  <>
                    <span className={`tabular font-medium ${down ? 'text-danger' : change === '0%' ? 'text-ink' : 'text-promo-save'}`}>
                      {change}
                    </span>{' '}
                    dari {days} hari sebelumnya
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div id="tren-grafik" role="tabpanel" aria-labelledby={`tab-${metric}`} className="px-3 pb-4 pt-5 sm:px-5">
        <LineChart
          label={`${info.label}, ${days} hari terakhir`}
          data={data}
          series={[
            { key: 'now', label: `${days} hari terakhir`, color: 'var(--accent)', area: true },
            { key: 'before', label: `${days} hari sebelumnya`, color: 'var(--border-strong)', dashed: true, area: false },
          ]}
          unit={info.unit}
          height={260}
          formatValue={(value) => (info.money ? formatRupiah(value) : value.toLocaleString('id-ID'))}
          // Order dan pasang selalu bulat, jadi garis bantu pecahan dibiarkan tanpa label.
          formatTick={(value) => (info.money ? compactRupiah.format(value) : Number.isInteger(value) ? value.toLocaleString('id-ID') : '')}
          emptyLabel="Belum ada transaksi di rentang ini"
        />
      </div>
    </section>
  );
}
