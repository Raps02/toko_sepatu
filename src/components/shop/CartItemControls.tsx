'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { changeCartVariantAction, removeCartItemAction, updateCartItemAction } from '@/actions/cart.actions';
import { Alert } from '@/components/arc/alert/alert';
import { Select } from '@/components/arc/select/select';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { sortSizes } from '@/lib/sizes';

type Variant = { id: string; size: string; color: string; stock: number };

type Props = {
  cartItemId: string;
  productName: string;
  quantity: number;
  variantId: string;
  /** Varian aktif dari produk yang sama. */
  variants: Variant[];
  maxPerItem: number;
};

/** Sudut pil seperti kontrol keranjang sebelumnya. */
const PILL = { '--radius-control': '9999px' } as CSSProperties;

/** Warna, ukuran, jumlah, dan hapus untuk satu barang di keranjang. Tiap perubahan langsung disimpan. */
export function CartItemControls({ cartItemId, productName, quantity: initialQuantity, variantId, variants, maxPerItem }: Props) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = variants.find((v) => v.id === variantId);
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizesForColor = (color: string) => {
    const inColor = variants.filter((v) => v.color === color);
    const order = sortSizes(inColor.map((v) => v.size));
    return inColor.toSorted((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
  };
  const maxQuantity = Math.max(1, Math.min(current?.stock ?? 1, maxPerItem));

  function run(action: (formData: FormData) => Promise<{ success: boolean; message?: string }>, fields: Record<string, string>, onFail?: () => void) {
    setError(null);
    setNotice(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.success) {
        setError(result.message ?? 'Perubahan belum tersimpan. Coba lagi.');
        onFail?.();
      } else if (result.message) {
        setNotice(result.message);
      }
    });
  }

  function changeQuantity(next: number) {
    const previous = quantity;
    setQuantity(next);
    run(updateCartItemAction, { cartItemId, quantity: String(next) }, () => setQuantity(previous));
  }

  function changeVariant(next: Variant | undefined) {
    if (!next || next.id === variantId) return;
    run(changeCartVariantAction, { cartItemId, variantId: next.id });
  }

  function changeColor(color: string) {
    const options = sizesForColor(color);
    // Pertahankan ukuran yang sama kalau ada stoknya di warna baru.
    changeVariant(options.find((v) => v.size === current?.size && v.stock > 0) ?? options.find((v) => v.stock > 0));
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2" style={PILL}>
        {colors.length > 1 ? (
          <div className="w-36">
            <Select
              id={`color-${cartItemId}`}
              label={`Warna ${productName}`}
              hideLabel
              value={current?.color ?? ''}
              disabled={pending}
              onValueChange={changeColor}
              options={colors.map((color) => {
                const available = variants.some((v) => v.color === color && v.stock > 0);
                return {
                  value: color,
                  label: available ? color : `${color} (habis)`,
                  disabled: !available && color !== current?.color,
                };
              })}
            />
          </div>
        ) : null}

        <div className="w-40">
          <Select
            id={`size-${cartItemId}`}
            label={`Ukuran ${productName}`}
            hideLabel
            value={variantId}
            disabled={pending}
            onValueChange={(id) => changeVariant(variants.find((v) => v.id === id))}
            options={sizesForColor(current?.color ?? '').map((v) => ({
              value: v.id,
              label: `Ukuran ${v.size}${v.stock === 0 ? ' (habis)' : ''}`,
              disabled: v.stock === 0 && v.id !== variantId,
            }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <QuantityStepper value={quantity} max={maxQuantity} onChange={changeQuantity} itemLabel={productName} disabled={pending} />
        <Button
          variant="ghost"
          style={PILL}
          disabled={pending}
          onClick={() => run(async () => removeCartItemAction(cartItemId), {})}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Hapus
        </Button>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-muted motion-reduce:animate-none" aria-label="Menyimpan" />}
      </div>

      {error && <Alert tone="danger" title={error} />}
      {notice && <Alert tone="success" title={notice} />}
    </div>
  );
}
