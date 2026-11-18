'use client';

import { forwardRef, type CSSProperties } from 'react';
import { Button as ArcButton, type ButtonProps as ArcButtonProps } from '@/components/arc/button/button';
import type { ButtonVariant } from '@/components/ui/styles';

/**
 * Tombol toko di atas Button Arc.
 *
 * Varian lama (lihat buttonClass di styles.ts) dipetakan ke varian Arc, jadi
 * tampilannya tetap sama dengan tombol lain di website: hitam ink untuk aksi
 * utama, pil untuk toko, kuning marka untuk sorotan. Link tetap memakai
 * buttonClass, karena Button Arc selalu berupa <button>.
 */
type Props = Omit<ArcButtonProps, 'variant'> & { variant?: ButtonVariant };

const PILL = { '--radius-control': '9999px' } as CSSProperties;

const VARIANTS: Record<ButtonVariant, { variant: ArcButtonProps['variant']; style?: CSSProperties }> = {
  primary: { variant: 'primary' },
  secondary: { variant: 'secondary' },
  danger: { variant: 'danger' },
  ghost: { variant: 'ghost' },
  // Tombol utama Arc memakai --foreground sebagai latar dan --background sebagai teks.
  marking: { variant: 'primary', style: { '--foreground': '#F2B233', '--background': '#111111' } as CSSProperties },
  ink: { variant: 'primary', style: PILL },
  pillSecondary: { variant: 'secondary', style: PILL },
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', style, type = 'button', ...props },
  ref,
) {
  const mapped = VARIANTS[variant];
  return <ArcButton ref={ref} type={type} variant={mapped.variant} style={{ ...mapped.style, ...style }} {...props} />;
});
