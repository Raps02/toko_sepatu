import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/arc/alert/alert';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { AddressForm } from '@/components/shop/AddressForm';
import { CheckoutForm } from '@/components/shop/CheckoutForm';
import { CheckoutLeaveGuard } from '@/components/shop/CheckoutLeaveGuard';
import { formatRupiah } from '@/lib/format';
import { PAYMENT_WINDOW_HOURS } from '@/lib/orders';
import { FREE_SHIPPING_MIN_PAIRS, resolvePrice, sumCart, totalPairs } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pengiriman dan pembayaran' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

const variantInclude = { product: { include: { discounts: { where: { isActive: true } } } } } as const;

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission('shop.buy');
  const params = await searchParams;

  // "Beli Sekarang" dari halaman produk: hanya varian ini, keranjang tidak ikut.
  const buyVariantId = first(params.beli);
  const buyQuantity = Math.min(Math.max(Number.parseInt(first(params.jumlah), 10) || 1, 1), 10);

  const [buyVariant, cartItems, addresses, rates] = await Promise.all([
    buyVariantId ? prisma.productVariant.findUnique({ where: { id: buyVariantId }, include: variantInclude }) : null,
    buyVariantId
      ? []
      : prisma.cartItem.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
          include: { variant: { include: variantInclude } },
        }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.shippingRate.findMany({ orderBy: { province: 'asc' } }),
  ]);

  let cart: { id: string; quantity: number; variant: NonNullable<typeof buyVariant> }[];
  if (buyVariantId) {
    if (!buyVariant || !buyVariant.isActive || !buyVariant.product.isPublished || buyVariant.stock === 0) {
      redirect(buyVariant ? `/products/${buyVariant.product.slug}` : '/products');
    }
    cart = [{ id: buyVariant.id, quantity: Math.min(buyQuantity, buyVariant.stock), variant: buyVariant }];
  } else {
    cart = cartItems;
  }
  if (cart.length === 0) redirect('/cart');
  const buyNow = buyVariantId ? { variantId: cart[0].variant.id, quantity: cart[0].quantity } : undefined;

  const lines = cart.map((item) => {
    const price = resolvePrice(item.variant.product.basePrice, item.variant.product.discounts);
    return { item, price };
  });
  const totals = sumCart(lines.map((l) => ({ unitPrice: l.price.basePrice, discountAmount: l.price.discountAmount, quantity: l.item.quantity })));

  const freeShipping = totalPairs(cart) >= FREE_SHIPPING_MIN_PAIRS;
  const costByProvince = new Map(rates.map((rate) => [rate.province.toLowerCase(), rate.cost]));
  const checkoutAddresses = addresses.map((address) => ({
    id: address.id,
    label: address.label,
    recipient: address.recipient,
    phone: address.phone,
    street: address.street,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    isDefault: address.isDefault,
    // Tarif normal provinsi; kalau gratis ongkir, CheckoutForm menampilkannya dicoret.
    shippingCost: costByProvince.get(address.province.toLowerCase()) ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <CheckoutLeaveGuard
        buyNow={Boolean(buyNow)}
        summary={
          cart.length === 1
            ? `${cart[0].variant.product.name} × ${cart[0].quantity}`
            : `${cart.length} sepatu (${totalPairs(cart)} pasang)`
        }
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink">Pengiriman &amp; Pembayaran</h1>

      <div className="mt-6">
        <Panel title="Isi pesanan" description={buyNow ? 'Beli langsung: hanya sepatu ini yang dipesan, isi keranjangmu tidak berubah.' : undefined}>
          <ul className={`tabular text-sm ${panelListClass}`}>
          {lines.map(({ item, price }) => (
            <li key={item.id} className="flex justify-between gap-4 px-5 py-2.5">
              <span className="text-ink">
                {item.variant.product.name}, {item.variant.color}, ukuran {item.variant.size}{' '}
                <span className="text-ink-muted">× {item.quantity}</span>
              </span>
              <span className="font-medium text-ink">{formatRupiah(price.finalPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        </Panel>
      </div>

      <div className="mt-8">
        {checkoutAddresses.length > 0 ? (
          <CheckoutForm
            addresses={checkoutAddresses}
            subtotal={totals.subtotal}
            discountTotal={totals.discountTotal}
            paymentWindowHours={PAYMENT_WINDOW_HOURS}
            freeShipping={freeShipping}
            buyNow={buyNow}
          />
        ) : (
          <Alert tone="warning" title="Kamu belum punya alamat pengiriman.">Tambahkan satu di bawah ini untuk melanjutkan.</Alert>
        )}
      </div>

      <div className="mt-8">
        <Disclosure title="Tambah alamat baru" defaultOpen={checkoutAddresses.length === 0}>
          <AddressForm provinces={rates.map((rate) => rate.province)} defaultRecipient={user.name} />
        </Disclosure>
      </div>
    </div>
  );
}
