import { describe, expect, it } from 'vitest';
import {
  discountAmountFor,
  isDiscountLive,
  movingAverageCost,
  resolvePrice,
  shippingCostFor,
  sumCart,
  totalPairs,
  type DiscountLike,
} from '@/lib/pricing';

const now = new Date('2026-11-16T05:00:00Z');
const discount = (overrides: Partial<DiscountLike> = {}): DiscountLike => ({
  type: 'PERCENT',
  value: 10,
  startsAt: new Date('2026-11-01T00:00:00Z'),
  endsAt: null,
  isActive: true,
  ...overrides,
});

describe('isDiscountLive', () => {
  it('berlaku di antara tanggal mulai dan selesai', () => {
    expect(isDiscountLive(discount(), now)).toBe(true);
    expect(isDiscountLive(discount({ endsAt: new Date('2026-11-17T00:00:00Z') }), now)).toBe(true);
  });

  it('tidak berlaku kalau belum mulai, sudah selesai, atau dinonaktifkan', () => {
    expect(isDiscountLive(discount({ startsAt: new Date('2026-11-17T00:00:00Z') }), now)).toBe(false);
    expect(isDiscountLive(discount({ endsAt: new Date('2026-11-16T05:00:00Z') }), now)).toBe(false);
    expect(isDiscountLive(discount({ isActive: false }), now)).toBe(false);
  });
});

describe('discountAmountFor', () => {
  it('menghitung persen dengan pembulatan ke bawah', () => {
    expect(discountAmountFor(749000, { type: 'PERCENT', value: 15 })).toBe(112350);
    expect(discountAmountFor(999, { type: 'PERCENT', value: 33 })).toBe(329);
  });

  it('tidak pernah melebihi harga atau menjadi negatif', () => {
    expect(discountAmountFor(100000, { type: 'FIXED', value: 250000 })).toBe(100000);
    expect(discountAmountFor(100000, { type: 'PERCENT', value: 150 })).toBe(100000);
    expect(discountAmountFor(100000, { type: 'FIXED', value: -5000 })).toBe(0);
    expect(discountAmountFor(0, { type: 'PERCENT', value: 50 })).toBe(0);
  });
});

describe('resolvePrice', () => {
  it('mengembalikan harga dasar kalau tidak ada diskon yang berlaku', () => {
    expect(resolvePrice(500000, [], now)).toEqual({ basePrice: 500000, finalPrice: 500000, discountAmount: 0, percentOff: 0 });
    expect(resolvePrice(500000, [discount({ isActive: false })], now).finalPrice).toBe(500000);
  });

  it('memakai diskon yang potongannya paling besar', () => {
    const price = resolvePrice(500000, [discount({ value: 10 }), discount({ type: 'FIXED', value: 80000 })], now);
    expect(price.discountAmount).toBe(80000);
    expect(price.finalPrice).toBe(420000);
    expect(price.percentOff).toBe(16);
  });

  it('mengabaikan diskon yang sudah berakhir walau potongannya lebih besar', () => {
    const expired = discount({ value: 50, endsAt: new Date('2026-11-10T00:00:00Z') });
    expect(resolvePrice(500000, [expired, discount({ value: 10 })], now).finalPrice).toBe(450000);
  });
});

describe('sumCart', () => {
  it('menjumlahkan harga, diskon, dan ongkir', () => {
    const totals = sumCart(
      [
        { unitPrice: 749000, discountAmount: 112350, quantity: 2 },
        { unitPrice: 459000, discountAmount: 0, quantity: 1 },
      ],
      15000,
    );
    expect(totals).toEqual({ subtotal: 1957000, discountTotal: 224700, shippingCost: 15000, total: 1747300 });
  });

  it('keranjang kosong bernilai nol', () => {
    expect(sumCart([])).toEqual({ subtotal: 0, discountTotal: 0, shippingCost: 0, total: 0 });
  });
});

describe('movingAverageCost', () => {
  it('merata-ratakan modal lama dan kiriman baru menurut jumlahnya', () => {
    expect(movingAverageCost(10, 400000, 10, 500000)).toBe(450000);
    expect(movingAverageCost(30, 400000, 10, 500000)).toBe(425000);
  });

  it('memakai modal kiriman baru kalau stok sebelumnya kosong', () => {
    expect(movingAverageCost(0, 0, 5, 430000)).toBe(430000);
    expect(movingAverageCost(0, 999999, 5, 430000)).toBe(430000);
  });
});

describe('gratis ongkir', () => {
  it('1 pasang bayar ongkir, 2 pasang atau lebih gratis', () => {
    expect(shippingCostFor(17000, 1)).toBe(17000);
    expect(shippingCostFor(17000, 2)).toBe(0);
    expect(shippingCostFor(65000, 5)).toBe(0);
  });

  it('menghitung pasang dari jumlah, bukan jumlah baris', () => {
    expect(totalPairs([{ quantity: 2 }])).toBe(2);
    expect(totalPairs([{ quantity: 1 }, { quantity: 1 }])).toBe(2);
    expect(totalPairs([])).toBe(0);
  });
});
