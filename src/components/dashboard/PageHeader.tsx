import type { CSSProperties, ReactNode } from 'react';
import { Badge as ArcBadge, type BadgeTone } from '@/components/arc/badge/badge';
import { EmptyState as ArcEmptyState } from '@/components/arc/empty-state/empty-state';

/**
 * Kepala halaman dashboard. Judul memakai Barlow Condensed (huruf display toko),
 * `tag` untuk keterangan status singkat di samping judul, mis. "Mode harian".
 */
export function PageHeader({
  title,
  description,
  tag,
  actions,
}: {
  title: string;
  description?: string;
  tag?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.5rem]">{title}</h1>
          {tag && <Badge tone="neutral">{tag}</Badge>}
        </div>
        {description && <p className="mt-2 max-w-[65ch] text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <ArcEmptyState title={title} description={hint ?? ''} action={action} />;
}

// Nada status toko dipetakan ke nada Badge Arc. "dark" tidak ada di Arc, jadi
// warnanya diisi langsung lewat variabel badge.
const TONES = {
  neutral: { tone: 'neutral' },
  good: { tone: 'success' },
  warn: { tone: 'warning' },
  bad: { tone: 'danger' },
  dark: {
    tone: 'neutral',
    style: { '--badge-background': '#111111', '--badge-foreground': '#ffffff', '--badge-color': '#ffffff' } as CSSProperties,
  },
} as const satisfies Record<string, { tone: BadgeTone; style?: CSSProperties }>;

export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const mapped: { tone: BadgeTone; style?: CSSProperties } = TONES[tone];
  return (
    <ArcBadge tone={mapped.tone} pill style={mapped.style} className="whitespace-nowrap">
      {children}
    </ArcBadge>
  );
}
