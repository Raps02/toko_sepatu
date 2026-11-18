// Satu-satunya tempat harga akhir dihitung. Katalog, keranjang, dan checkout
// semuanya memanggil fungsi di sini supaya angkanya tidak pernah berbeda.

export type DiscountLike = {
  type: 'PERCENT' | 'FIXED';
  value: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
};

export type ResolvedPrice = {
  basePrice: number;
  finalPrice: number;
  /** Potongan per pasang dalam rupiah. */
  discountAmount: number;
  /** Persen potongan dibulatkan, untuk label "-20%". */
  percentOff: number;
};

export function isDiscountLive(discount: DiscountLike, now: Date = new Date()): boolean {
  if (!discount.isActive) return false;
  if (discount.startsAt.getTime() > now.getTime()) return false;
  if (discount.endsAt && discount.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Potongan per pasang untuk satu diskon; tidak pernah negatif atau melebihi harga. */
export function discountAmountFor(basePrice: number, discount: Pick<DiscountLike, 'type' | 'value'>): number {
  if (basePrice <= 0 || discount.value <= 0) return 0;
  const raw =
    discount.type === 'PERCENT'
      ? Math.floor((basePrice * Math.min(discount.value, 100)) / 100)
      : discount.value;
  return Math.max(0, Math.min(raw, basePrice));
}

/** Harga akhir: dari semua diskon yang sedang berlaku, dipakai yang potongannya terbesar. */
export function resolvePrice(
  basePrice: number,
  discounts: readonly DiscountLike[] = [],
  now: Date = new Date(),
): ResolvedPrice {
  let discountAmount = 0;
  for (const discount of discounts) {
    if (!isDiscountLive(discount, now)) continue;
    discountAmount = Math.max(discountAmount, discountAmountFor(basePrice, discount));
  }
  const finalPrice = basePrice - discountAmount;
  const percentOff = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
  return { basePrice, finalPrice, discountAmount, percentOff };
}

export type CartLine = { unitPrice: number; discountAmount: number; quantity: number };

/** Batas pasang per ukuran dalam satu pesanan (keranjang maupun Beli Sekarang). */
export const MAX_PAIRS_PER_ITEM = 10;

/** Gratis ongkir kalau satu pesanan berisi minimal sekian pasang (boleh model yang sama). */
export const FREE_SHIPPING_MIN_PAIRS = 2;

export function totalPairs(lines: readonly { quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Ongkir yang dibayar pembeli: tarif provinsi, atau 0 kalau memenuhi syarat gratis ongkir. */
export function shippingCostFor(rate: number, pairs: number): number {
  return pairs >= FREE_SHIPPING_MIN_PAIRS ? 0 : rate;
}

export function sumCart(lines: readonly CartLine[], shippingCost = 0) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discountTotal = lines.reduce((sum, l) => sum + l.discountAmount * l.quantity, 0);
  return { subtotal, discountTotal, shippingCost, total: subtotal - discountTotal + shippingCost };
}

/** Harga modal rata-rata bergerak setelah barang masuk. */
export function movingAverageCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number,
): number {
  const stock = Math.max(currentStock, 0);
  const totalQty = stock + incomingQty;
  if (totalQty <= 0) return incomingUnitCost;
  return Math.round((stock * currentAvgCost + incomingQty * incomingUnitCost) / totalQty);
}
