// Stok berkurang saat order dibuat, jadi order yang belum dibayar menahan stok.
// Batas ini mencegah satu akun menahan stok toko tanpa membayar.

export const MAX_UNPAID_ORDERS = 3;
export const MAX_UNPAID_PAIRS = 12;

/** Pesan penolakan kalau order baru melewati batas, atau null kalau boleh. */
export function unpaidLimitError(unpaidOrders: number, unpaidPairs: number, newPairs: number): string | null {
  if (unpaidOrders >= MAX_UNPAID_ORDERS) {
    return `Kamu masih punya ${unpaidOrders} pesanan yang belum dibayar. Bayar atau batalkan dulu sebelum membuat pesanan baru.`;
  }
  if (unpaidPairs + newPairs > MAX_UNPAID_PAIRS) {
    return `Maksimal ${MAX_UNPAID_PAIRS} pasang boleh menunggu pembayaran. Bayar atau batalkan pesanan lain, atau kurangi jumlahnya.`;
  }
  return null;
}
