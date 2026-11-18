import Link from 'next/link';
import type { ComponentProps, CSSProperties } from 'react';
import styles from '@/components/arc/button/button.module.css';

type Props = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Sudut membulat penuh, gaya tombol di halaman toko. */
  pill?: boolean;
};

const PILL = { '--radius-control': '9999px' } as CSSProperties;

/** Tautan yang tampil seperti Button Arc. Button Arc selalu berupa <button>, jadi navigasi memakai ini. */
export function ButtonLink({ variant = 'secondary', size = 'md', pill = false, className, style, ...props }: Props) {
  return (
    <Link
      {...props}
      style={pill ? { ...PILL, ...style } : style}
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
    />
  );
}
