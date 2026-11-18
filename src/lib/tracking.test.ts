import { describe, expect, it } from 'vitest';
import { ORIGIN_CITY, trackShipment, type TrackingInput, type TrackingPace } from './tracking';

const REALTIME: TrackingPace = { mode: 'realtime', speed: 1 };
const SECOND = 1000;

const HOUR = 60 * 60 * 1000;
const shippedAt = new Date('2026-11-18T05:21:00Z');

const toBandung: TrackingInput = {
  orderNumber: 'LK-261118-ABC234',
  courier: 'JNE',
  trackingNumber: '298983293829489242',
  shippedAt,
  recipient: 'Budi',
  city: 'Bandung',
  province: 'Jawa Barat',
};

const toJakarta: TrackingInput = { ...toBandung, city: 'Jakarta Barat', province: 'DKI Jakarta' };

describe('trackShipment (simulasi)', () => {
  it('saat baru dikirim hanya ada kabar serah terima ke kurir', () => {
    const result = trackShipment(toBandung, shippedAt, REALTIME);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ title: 'Paket diserahkan Langkah Kaki ke kurir JNE', location: ORIGIN_CITY });
    expect(result.delivered).toBe(false);
    expect(result.source).toBe('simulasi');
  });

  it('kabar bertambah seiring waktu, terbaru di atas', () => {
    const result = trackShipment(toBandung, shippedAt.getTime() + 12 * HOUR, REALTIME);
    expect(result.events.map((e) => e.title)).toEqual([
      'Paket berangkat menuju Jawa Barat',
      'Paket diproses di gudang sortir',
      'Paket diterima di gerai JNE',
      'Paket diserahkan Langkah Kaki ke kurir JNE',
    ]);
    const times = result.events.map((e) => new Date(e.at).getTime());
    expect(times).toEqual(times.toSorted((a, b) => b - a));
  });

  it('akhirnya paket sampai ke penerima di kota tujuan', () => {
    const result = trackShipment(toBandung, shippedAt.getTime() + 3 * 24 * HOUR, REALTIME);
    expect(result.delivered).toBe(true);
    expect(result.events[0]).toMatchObject({ title: 'Paket diterima oleh Budi', location: 'Bandung', delivered: true });
    expect(new Date(result.estimatedArrival).getTime()).toBe(new Date(result.events[0]!.at).getTime());
  });

  it('pengiriman dalam DKI Jakarta lebih cepat dan tanpa antar provinsi', () => {
    const result = trackShipment(toJakarta, shippedAt.getTime() + 10 * HOUR, REALTIME);
    expect(result.delivered).toBe(true);
    expect(result.events.some((e) => e.title.startsWith('Paket berangkat menuju'))).toBe(false);
  });

  it('hasilnya selalu sama untuk pesanan yang sama', () => {
    const at = shippedAt.getTime() + 30 * HOUR;
    expect(trackShipment(toBandung, at, REALTIME)).toEqual(trackShipment(toBandung, at, REALTIME));
  });

  it('speed mempercepat mode realtime', () => {
    // Speed 60: 37 jam perjalanan selesai dalam kurang dari satu jam.
    expect(trackShipment(toBandung, shippedAt.getTime() + HOUR, { mode: 'realtime', speed: 60 }).delivered).toBe(true);
    expect(trackShipment(toBandung, shippedAt.getTime() + HOUR, REALTIME).delivered).toBe(false);
  });

  it('mode demo: kabar baru muncul tiap 5-10 detik', () => {
    const done = trackShipment(toBandung, shippedAt.getTime() + 10 * 60 * SECOND);
    const times = done.events.map((e) => new Date(e.at).getTime()).toReversed();
    expect(done.delivered).toBe(true);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i]! - times[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(5 * SECOND);
      expect(gap).toBeLessThanOrEqual(10 * SECOND);
    }
    // 4 detik setelah dikirim baru ada satu kabar.
    expect(trackShipment(toBandung, shippedAt.getTime() + 4 * SECOND).events).toHaveLength(1);
  });
});
