import { BRAND_COLORS, BRAND_MARK } from '@/lib/brand';
import { SITE } from '@/lib/site';

type BrandLogoProps = {
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
};

export function BrandMark({ className = 'h-6 w-8', accent = BRAND_COLORS.accent }: { className?: string; accent?: string }) {
  return (
    <svg viewBox={`0 0 ${BRAND_MARK.width} ${BRAND_MARK.height}`} className={className} fill="none" aria-hidden>
      {/* Langkah pertama (kiri / tumit ke depan) */}
      <path d={BRAND_MARK.stepLeft} fill="currentColor" />
      {/* Langkah kedua (kanan / dorongan ke depan) */}
      <path d={BRAND_MARK.stepRight} fill={accent} />
      {/* Garis aksen sol tipis */}
      <path d={BRAND_MARK.sole} stroke="currentColor" strokeWidth={BRAND_MARK.soleWidth} strokeLinecap="round" />
    </svg>
  );
}

const wordmarkSizes = {
  sm: 'text-xl',
  md: 'text-2xl sm:text-3xl',
  lg: 'text-3xl sm:text-4xl',
} as const;

const markSizes = {
  sm: 'h-5 w-7',
  md: 'h-6 w-8',
  lg: 'h-7 w-10',
} as const;

export function BrandLogo({ tone = 'dark', size = 'md', showWordmark = true }: BrandLogoProps) {
  const inkColor = tone === 'light' ? 'text-white' : 'text-ink';
  const accent = tone === 'light' ? BRAND_COLORS.accentOnDark : BRAND_COLORS.accent;

  return (
    <span className={`inline-flex items-center gap-2.5 ${inkColor}`}>
      <BrandMark className={markSizes[size]} accent={accent} />
      {showWordmark && (
        <span className={`font-display font-bold uppercase leading-none tracking-tight ${wordmarkSizes[size]}`}>
          {SITE.name}
        </span>
      )}
    </span>
  );
}
