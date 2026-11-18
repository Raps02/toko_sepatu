'use client';

import type { CSSProperties } from 'react';
import { NumberField } from '@/components/arc/number-field/number-field';

type Props = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Nama barang untuk label pembaca layar, mis. "Kota Low". */
  itemLabel?: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
};

/** Pengatur jumlah dengan tombol − dan + (NumberField Arc). Tidak bisa keluar dari rentang min..max. */
export function QuantityStepper({ value, min = 1, max, onChange, itemLabel, disabled = false, size = 'md' }: Props) {
  return (
    // Bentuk pil dan lebar ringkas seperti pengatur jumlah lama.
    <div style={{ '--radius-control': '9999px', '--number-field-width': size === 'lg' ? '9.5rem' : '8.5rem' } as CSSProperties}>
      <NumberField
        label={itemLabel ? `Jumlah ${itemLabel}` : 'Jumlah'}
        hideLabel
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        size={size}
        limitHint={(edge, limit) => (edge === 'max' ? `Maks. ${limit} pasang` : `Min. ${limit} pasang`)}
      />
    </div>
  );
}
