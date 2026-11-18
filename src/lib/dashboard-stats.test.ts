import { describe, expect, it } from 'vitest';
import { buildDailySeries, changeText, shiftDateKey } from './dashboard-stats';

describe('shiftDateKey', () => {
  it('melewati batas bulan dan tahun', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('buildDailySeries', () => {
  it('mengisi hari kosong dengan nol dan mengelompokkan per tanggal WIB', () => {
    const series = buildDailySeries(
      [
        // 23:30 WIB tanggal 17, masih masuk tanggal 17.
        { paidAt: new Date('2026-11-17T16:30:00Z'), total: 500_000, pairs: 1 },
        // 00:30 WIB tanggal 18.
        { paidAt: new Date('2026-11-17T17:30:00Z'), total: 300_000, pairs: 2 },
        // Di luar rentang.
        { paidAt: new Date('2026-11-01T05:00:00Z'), total: 999_000, pairs: 9 },
      ],
      [{ shippedAt: new Date('2026-11-18T03:00:00Z') }],
      '2026-11-18',
      3,
    );
    expect(series.map((d) => d.key)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(series[0]).toMatchObject({ revenue: 0, orders: 0, pairs: 0, shipped: 0 });
    expect(series[1]).toMatchObject({ revenue: 500_000, orders: 1, pairs: 1 });
    expect(series[2]).toMatchObject({ revenue: 300_000, orders: 1, pairs: 2, shipped: 1 });
  });
});

describe('changeText', () => {
  it('memberi tanda arah', () => {
    expect(changeText(120, 100)).toBe('+20%');
    expect(changeText(80, 100)).toBe('−20%');
    expect(changeText(100, 100)).toBe('0%');
  });
  it('null kalau periode sebelumnya nol', () => {
    expect(changeText(5, 0)).toBeNull();
  });
});
