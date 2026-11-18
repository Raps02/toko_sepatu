import { describe, expect, it } from 'vitest';
import { MAX_UNPAID_ORDERS, MAX_UNPAID_PAIRS, unpaidLimitError } from './order-limits';

describe('unpaidLimitError', () => {
  it('mengizinkan pesanan dalam batas', () => {
    expect(unpaidLimitError(MAX_UNPAID_ORDERS - 1, 0, MAX_UNPAID_PAIRS)).toBeNull();
  });
  it('menolak kalau jumlah pesanan belum dibayar sudah penuh', () => {
    expect(unpaidLimitError(MAX_UNPAID_ORDERS, 0, 1)).toContain('belum dibayar');
  });
  it('menolak kalau total pasang melewati batas', () => {
    expect(unpaidLimitError(1, MAX_UNPAID_PAIRS, 1)).toContain('pasang');
  });
});
