'use client';

import { useState } from 'react';
import { checkoutAction } from '@/actions/order.actions';
import { RadioCards } from '@/components/arc/radio-cards/radio-cards';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/ActionForm';
import { TextAreaField } from '@/components/ui/Field';
import { formatRupiah } from '@/lib/format';

export type CheckoutAddress = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
  /** null kalau toko belum melayani provinsi alamat ini. */
  shippingCost: number | null;
};

type Props = {
  addresses: CheckoutAddress[];
  subtotal: number;
  discountTotal: number;
  paymentWindowHours: number;
  /** Pesanan memenuhi syarat gratis ongkir (minimal 2 pasang). */
  freeShipping: boolean;
  /** Checkout langsung satu varian ("Beli Sekarang"), bukan isi keranjang. */
  buyNow?: { variantId: string; quantity: number };
};

export function CheckoutForm({ addresses, subtotal, discountTotal, paymentWindowHours, freeShipping, buyNow }: Props) {
  const firstUsable = addresses.find((a) => a.isDefault && a.shippingCost !== null) ?? addresses.find((a) => a.shippingCost !== null);
  const [addressId, setAddressId] = useState(firstUsable?.id ?? '');

  const selected = addresses.find((a) => a.id === addressId) ?? null;
  const shippingCost = selected?.shippingCost == null ? null : freeShipping ? 0 : selected.shippingCost;
  // Angka di sini hanya pratinjau; total sebenarnya dihitung ulang di server saat pesanan dibuat.
  const total = subtotal - discountTotal + (shippingCost ?? 0);

  return (
    <ActionForm action={checkoutAction} className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      {buyNow && (
        <>
          <input type="hidden" name="buyVariantId" value={buyNow.variantId} />
          <input type="hidden" name="buyQuantity" value={buyNow.quantity} />
        </>
      )}
      <div className="space-y-6">
        <Panel title="Kirim ke mana?">
          <RadioCards
            aria-label="Alamat pengiriman"
            name="addressId"
            layout="list"
            required
            value={addressId}
            onValueChange={setAddressId}
            options={addresses.map((address) => {
              const usable = address.shippingCost !== null;
              return {
                value: address.id,
                label: `${address.label}: ${address.recipient}`,
                description: (
                  <>
                    {address.phone}
                    <br />
                    {address.street}, {address.city}, {address.province} {address.postalCode}
                  </>
                ),
                disabled: !usable,
                disabledReason: 'Toko belum melayani provinsi ini',
                meta: usable ? (
                  <span className="tabular text-right text-sm">
                    <span className="block text-xs text-ink-muted">Ongkir</span>
                    {freeShipping ? <span className="font-medium text-promo-save">Gratis</span> : formatRupiah(address.shippingCost ?? 0)}
                  </span>
                ) : undefined,
              };
            })}
          />
          <FieldError name="addressId" />
        </Panel>

        <TextAreaField label="Catatan untuk toko" name="note" rows={2} maxLength={200} placeholder="Opsional. Misal: titip ke satpam" />
      </div>

      <aside className="h-fit">
        <Panel title="Total pembayaran">
        <dl className="tabular space-y-2.5 text-sm">
          <div className="flex justify-between text-ink-muted">
            <dt>Harga barang</dt>
            <dd className="text-ink">{formatRupiah(subtotal)}</dd>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-promo-save">
              <dt>Diskon</dt>
              <dd>-{formatRupiah(discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between text-ink-muted">
            <dt>Ongkir</dt>
            <dd className={shippingCost === 0 && freeShipping ? 'font-semibold text-promo-save' : 'text-ink'}>
              {shippingCost === null ? 'Pilih alamat' : freeShipping ? 'Gratis' : formatRupiah(shippingCost)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-studio-line pt-3 text-base font-bold text-ink">
            <dt>Total</dt>
            <dd aria-live="polite">{formatRupiah(total)}</dd>
          </div>
        </dl>

        <SubmitButton variant="ink" pendingLabel="Membuat pesanan…" size="lg" className="mt-5 w-full">
          Buat Pesanan &amp; Bayar
        </SubmitButton>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Stok dikunci untukmu selama {paymentWindowHours} jam. Kalau belum dibayar sampai batas itu, pesanan batal otomatis.
        </p>
        </Panel>
      </aside>
    </ActionForm>
  );
}
