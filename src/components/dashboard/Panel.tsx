import type { ReactNode } from 'react';
import { Card } from '@/components/arc/card/card';

/** Kelas untuk daftar baris yang menempel ke tepi Panel. */
export const panelListClass = '-mx-5 -mb-5 divide-y divide-studio-line border-t border-studio-line';

/** Panel kerja dashboard di atas Card Arc: judul, keterangan, lalu isi. */
export function Panel({
  title,
  description,
  aside,
  tone = 'default',
  className,
  children,
}: {
  title: ReactNode;
  description?: string;
  /** Penanda kecil di samping judul, mis. Badge. */
  aside?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
  children?: ReactNode;
}) {
  const heading = <span className={tone === 'danger' ? 'text-danger' : undefined}>{title}</span>;
  return (
    <Card
      still
      title={aside ? <span className="flex flex-wrap items-center gap-2">{heading}{aside}</span> : heading}
      description={description}
      className={[tone === 'danger' ? '!border-danger/25 !bg-danger-tint/40' : '', className].filter(Boolean).join(' ')}
    >
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}
