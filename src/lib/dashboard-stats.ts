// Angka harian untuk grafik ringkasan dashboard. Bagian ini murni (tanpa
// Prisma) supaya bisa dites; query-nya ada di halaman dashboard.

import { dateKey } from './format';

export type DayStat = {
  /** Tanggal WIB, YYYY-MM-DD. */
  key: string;
  /** Total uang order yang dibayar di hari itu. Dikosongkan (0) untuk SPV. */
  revenue: number;
  /** Jumlah order yang dibayar di hari itu. */
  orders: number;
  /** Jumlah pasang dari order yang dibayar di hari itu. */
  pairs: number;
  /** Jumlah order yang dikirim di hari itu. */
  shipped: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Geser tanggal YYYY-MM-DD sebanyak `days` hari (boleh negatif). */
export function shiftDateKey(key: string, days: number): string {
  const noon = new Date(`${key}T12:00:00+07:00`).getTime();
  return dateKey(new Date(noon + days * DAY_MS));
}

/**
 * Susun `days` hari terakhir sampai `endKey` (inklusif), urut dari yang
 * terlama. Hari tanpa transaksi tetap muncul dengan angka nol, supaya garis
 * grafik tidak melompat.
 */
export function buildDailySeries(
  paid: { paidAt: Date; total: number; pairs: number }[],
  shipped: { shippedAt: Date }[],
  endKey: string,
  days: number,
): DayStat[] {
  const series: DayStat[] = [];
  const byKey = new Map<string, DayStat>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const day: DayStat = { key: shiftDateKey(endKey, -offset), revenue: 0, orders: 0, pairs: 0, shipped: 0 };
    series.push(day);
    byKey.set(day.key, day);
  }
  for (const order of paid) {
    const day = byKey.get(dateKey(order.paidAt));
    if (!day) continue;
    day.revenue += order.total;
    day.orders += 1;
    day.pairs += order.pairs;
  }
  for (const order of shipped) {
    const day = byKey.get(dateKey(order.shippedAt));
    if (day) day.shipped += 1;
  }
  return series;
}

/**
 * Perubahan dibanding periode sebelumnya sebagai teks bertanda, mis. "+12%".
 * Kalau periode sebelumnya nol, perbandingan persen tidak bermakna: hasilnya null.
 */
export function changeText(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}
