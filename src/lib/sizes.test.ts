import { describe, expect, it } from 'vitest';
import { parseGenderParam, SIZE_CHART, sizeChartFor, sizeInfo, suggestSize } from './sizes';

describe('sizeInfo', () => {
  it('mengenali ukuran Indonesia di tabel', () => {
    expect(sizeInfo('40')).toMatchObject({ id: 40, cm: 25 });
    expect(sizeInfo(' 37 ')).toMatchObject({ id: 37 });
  });

  it('mengembalikan null untuk ukuran di luar tabel', () => {
    expect(sizeInfo('40.5')).toBeNull();
    expect(sizeInfo('S')).toBeNull();
    expect(sizeInfo('')).toBeNull();
  });
});

describe('SIZE_CHART', () => {
  it('urut naik dan US wanita selalu 1,5 di atas US pria', () => {
    for (let i = 1; i < SIZE_CHART.length; i++) {
      expect(SIZE_CHART[i].id).toBeGreaterThan(SIZE_CHART[i - 1].id);
      expect(SIZE_CHART[i].cm).toBeGreaterThan(SIZE_CHART[i - 1].cm);
    }
    for (const row of SIZE_CHART) expect(row.usWanita - row.usPria).toBe(1.5);
  });
});

describe('sizeChartFor', () => {
  it('hanya mengambil ukuran yang dijual, urut, tanpa duplikat', () => {
    expect(sizeChartFor(['40', '38', '40', 'XL']).map((r) => r.id)).toEqual([38, 40]);
  });
});

describe('suggestSize', () => {
  it('memilih ukuran terkecil yang muat', () => {
    expect(suggestSize(25)?.id).toBe(40);
    expect(suggestSize(25.2)?.id).toBe(41);
    expect(suggestSize(21)?.id).toBe(35);
  });

  it('null untuk kaki di luar tabel atau input tidak valid', () => {
    expect(suggestSize(31)).toBeNull();
    expect(suggestSize(0)).toBeNull();
    expect(suggestSize(Number.NaN)).toBeNull();
  });
});

describe('parseGenderParam', () => {
  it('menerima pria/wanita tanpa peduli huruf besar', () => {
    expect(parseGenderParam('wanita')).toBe('WANITA');
    expect(parseGenderParam('Pria')).toBe('PRIA');
  });

  it('mengabaikan nilai lain', () => {
    expect(parseGenderParam('unisex')).toBeUndefined();
    expect(parseGenderParam('')).toBeUndefined();
    expect(parseGenderParam(undefined)).toBeUndefined();
  });
});
