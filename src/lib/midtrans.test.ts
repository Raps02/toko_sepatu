import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeSignature, fetchTransactionStatus, outcomeOf, verifySignature, type MidtransNotification } from '@/lib/midtrans';

const KEY = 'SB-Mid-server-kunci-uji';

function notification(overrides: Partial<MidtransNotification> = {}): MidtransNotification {
  const base = {
    order_id: 'LK-261116-ABC234',
    status_code: '200',
    gross_amount: '764000.00',
    transaction_status: 'settlement',
    ...overrides,
  };
  return { ...base, signature_key: overrides.signature_key ?? computeSignature(base, KEY) };
}

describe('signature Midtrans', () => {
  it('mengikuti rumus SHA-512(order_id + status_code + gross_amount + server key)', () => {
    const expected = createHash('sha512').update(`LK-261116-ABC234200764000.00${KEY}`).digest('hex');
    expect(computeSignature({ order_id: 'LK-261116-ABC234', status_code: '200', gross_amount: '764000.00' }, KEY)).toBe(expected);
  });

  it('menerima notifikasi dengan signature yang benar', () => {
    expect(verifySignature(notification(), KEY)).toBe(true);
    const upper = notification();
    expect(verifySignature({ ...upper, signature_key: upper.signature_key.toUpperCase() }, KEY)).toBe(true);
  });

  it('menolak kalau nominal, status, atau nomor order diubah setelah ditandatangani', () => {
    const signed = notification();
    expect(verifySignature({ ...signed, gross_amount: '1000.00' }, KEY)).toBe(false);
    expect(verifySignature({ ...signed, status_code: '201' }, KEY)).toBe(false);
    expect(verifySignature({ ...signed, order_id: 'LK-261116-ZZZ999' }, KEY)).toBe(false);
  });

  it('menolak signature palsu, kunci yang salah, atau kunci yang belum diisi', () => {
    expect(verifySignature(notification({ signature_key: 'palsu' }), KEY)).toBe(false);
    expect(verifySignature(notification(), 'kunci-lain')).toBe(false);
    expect(verifySignature(notification(), null)).toBe(false);
  });
});

describe('outcomeOf', () => {
  it('menganggap settlement dan capture yang lolos fraud sebagai dibayar', () => {
    expect(outcomeOf('settlement')).toBe('PAID');
    expect(outcomeOf('capture', 'accept')).toBe('PAID');
  });

  it('capture yang masih diperiksa fraud belum dianggap dibayar', () => {
    expect(outcomeOf('capture', 'challenge')).toBe('PENDING');
  });

  it('memetakan status lain', () => {
    expect(outcomeOf('pending')).toBe('PENDING');
    expect(outcomeOf('expire')).toBe('EXPIRED');
    expect(outcomeOf('deny')).toBe('FAILED');
    expect(outcomeOf('cancel')).toBe('FAILED');
    expect(outcomeOf('refund')).toBe('REFUNDED');
    expect(outcomeOf('status-yang-tidak-dikenal')).toBe('PENDING');
  });
});

describe('fetchTransactionStatus', () => {
  const originalKey = process.env.MIDTRANS_SERVER_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.MIDTRANS_SERVER_KEY;
    else process.env.MIDTRANS_SERVER_KEY = originalKey;
  });

  it('mengembalikan null jika Midtrans membalas HTTP 200 tanpa transaction_status (mis. 404 Transaction does not exist)', async () => {
    process.env.MIDTRANS_SERVER_KEY = KEY;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status_code: '404', status_message: "Transaction doesn't exist." }), { status: 200 }),
      ),
    );

    const result = await fetchTransactionStatus('LK-261116-ABC234');
    expect(result).toBeNull();
  });

  it('mengembalikan null dengan aman saat fetch gagal atau timeout', async () => {
    process.env.MIDTRANS_SERVER_KEY = KEY;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await fetchTransactionStatus('LK-261116-ABC234');
    expect(result).toBeNull();
  });

  it('mengembalikan payload status ketika transaction_status tersedia', async () => {
    process.env.MIDTRANS_SERVER_KEY = KEY;
    const payload = notification({ transaction_status: 'settlement', payment_type: 'bank_transfer' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));

    const result = await fetchTransactionStatus('LK-261116-ABC234');
    expect(result?.transaction_status).toBe('settlement');
    expect(result?.payment_type).toBe('bank_transfer');
  });
});
