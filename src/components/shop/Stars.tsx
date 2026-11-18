import type { CSSProperties } from 'react';
import { Rating } from '@/components/arc/rating/rating';

const SIZES: Record<'sm' | 'md', CSSProperties> = {
  sm: { '--rating-cell': '17px', '--rating-glyph': '16px' } as CSSProperties,
  md: { '--rating-cell': '21px', '--rating-glyph': '20px' } as CSSProperties,
};

/** Bintang rating (hanya tampilan) di atas Rating Arc, berwarna kuning marka. */
export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const style = { ...SIZES[size], '--warning': '#F2B233', '--border': '#E3E7EA' } as unknown as CSSProperties;
  return (
    <span className="inline-flex" style={style}>
      <Rating
        label="Rating"
        hideLabel
        readOnly
        allowHalf
        showValue={false}
        value={Math.round(value * 2) / 2}
      />
    </span>
  );
}
