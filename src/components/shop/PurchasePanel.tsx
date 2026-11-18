'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Truck } from 'lucide-react';
import { addToCartAction } from '@/actions/cart.actions';
import { Alert } from '@/components/arc/alert/alert';
import { SizeGuide } from '@/components/shop/SizeGuide';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { type Gender, sizeInfo } from '@/lib/sizes';

type Variant = { id: string; size: string; color: string; stock: number };

type Props = {
  /** Sudah diurutkan dari server: warna, lalu ukuran. */
  variants: Variant[];
  viewer: 'guest' | 'customer' | 'staff';
  gender: Gender;
  onColorChange?: (color: string) => void;
};

export function PurchasePanel({ variants, viewer, gender, onColorChange }: Props) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const firstAvailable = variants.find((v) => v.stock > 0);

  const [color, setColor] = useState(firstAvailable?.color ?? colors[0] ?? '');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const router = useRouter();

  const sizes = variants.filter((v) => v.color === color);
  const selected = sizes.find((v) => v.id === variantId) ?? null;
  const maxQuantity = Math.min(selected?.stock ?? 1, 10);

  if (variants.length === 0) {
    return (
      <Alert tone="info" title="Ukuran untuk sepatu ini belum tersedia." />
    );
  }

  return (
    <div className="space-y-6">
      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-ink">
            Pilih Warna: <span className="font-semibold">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((option) => {
              const active = option === color;
              return (
                <Button key={option} variant={active ? 'ink' : 'pillSecondary'} aria-pressed={active} onClick={() => {
                    setColor(option);
                    setVariantId(null);
                    setQuantity(1);
                    onColorChange?.(option);
                  }}>
                  {option}
                </Button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* min-w-0: fieldset bawaan browser melebar mengikuti tabel panduan ukuran. */}
      <fieldset className="min-w-0">
        <div className="mb-2.5 flex items-center justify-between">
          <legend className="text-sm font-medium text-ink">Pilih Ukuran (ID/EU)</legend>
          <span className="text-xs text-ink-muted">Stok diperbarui otomatis</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {sizes.map((variant) => {
            const active = variant.id === variantId;
            const soldOut = variant.stock === 0;
            const cm = sizeInfo(variant.size)?.cm;
            return (
              <Button
                key={variant.id}
                variant={active ? 'primary' : 'secondary'}
                disabled={soldOut}
                aria-pressed={active}
                onClick={() => {
                  setVariantId(variant.id);
                  setQuantity(1);
                }}
                className={`tabular !h-14 w-full !px-1 ${soldOut ? 'line-through' : ''}`}
              >
                <span className="flex flex-col items-center leading-tight">
                  {variant.size}
                  {cm !== undefined && <span className="text-[11px] font-normal opacity-75">{cm.toLocaleString('id-ID')} cm</span>}
                  {soldOut && <span className="sr-only"> (habis)</span>}
                </span>
              </Button>
            );
          })}
        </div>
        <p className="mt-2.5 min-h-5 text-sm text-ink-muted" aria-live="polite">
          {selected
            ? selected.stock <= 3
              ? `Tersisa ${selected.stock} pasang untuk ukuran ${selected.size}.`
              : `Ukuran ${selected.size} tersedia dan siap dikirim.`
            : 'Pilih ukuran di atas untuk melihat ketersediaan stok.'}
        </p>
        <SizeGuide sizes={[...new Set(variants.map((v) => v.size))]} gender={gender} />
      </fieldset>

      {viewer === 'customer' && (
        <ActionForm action={addToCartAction} className="space-y-4">
          <input type="hidden" name="variantId" value={variantId ?? ''} />
          <input type="hidden" name="quantity" value={quantity} />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink">Jumlah</span>
            <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} disabled={!selected} size="lg" />
            {selected && (
              <span className="text-xs text-ink-muted">Maks. {maxQuantity} pasang</span>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <SubmitButton variant="pillSecondary" size="lg" pendingLabel="Menambahkan…">
              {selected ? 'Masukkan Keranjang' : 'Pilih Ukuran Dulu'}
            </SubmitButton>
            <Button
              variant="ink"
              size="lg"
              disabled={!selected}
              loading={buying}
              onClick={() => {
                if (!selected) return;
                setBuying(true);
                // Langsung ke checkout untuk sepatu ini saja; keranjang tidak berubah.
                router.push(`/checkout?beli=${selected.id}&jumlah=${quantity}`);
              }}
            >
              Beli Sekarang
            </Button>
          </div>
        </ActionForm>
      )}

      {viewer === 'guest' && (
        <ButtonLink href="/login" variant="primary" size="lg" pill className="w-full">
          Masuk untuk Membeli
        </ButtonLink>
      )}

      {viewer === 'staff' && (
        <Alert tone="info" title="Kamu masuk sebagai staf toko.">Pembelian hanya bisa dilakukan dari akun pembeli.</Alert>
      )}

      <div className="space-y-2.5 border-t border-studio-line pt-5 text-sm text-ink-muted">
        <div className="flex items-center gap-3">
          <Truck className="h-4 w-4 shrink-0 text-ink" aria-hidden />
          <span>Gratis ongkir kalau beli minimal 2 pasang dalam satu pesanan.</span>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-ink" aria-hidden />
          <span>Garansi resmi &amp; tukar ukuran dalam 7 hari setelah barang diterima.</span>
        </div>
      </div>
    </div>
  );
}
