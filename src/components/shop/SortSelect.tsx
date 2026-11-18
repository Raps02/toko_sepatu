'use client';

import type { CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Select } from '@/components/arc/select/select';

type Props = {
  value: string;
  options: { value: string; label: string }[];
  /** Filter lain yang ikut dikirim supaya tidak hilang saat urutan diganti. */
  hidden: Record<string, string>;
};

/** Pilihan urutan katalog (Select Arc). Langsung diterapkan saat dipilih. */
export function SortSelect({ value, options, hidden }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(sort: string) {
    const params = new URLSearchParams();
    for (const [name, v] of Object.entries(hidden)) if (v) params.set(name, v);
    params.set('sort', sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2" style={{ '--radius-control': '9999px' } as CSSProperties}>
      <span className="text-sm text-ink-muted" aria-hidden>
        Urutkan
      </span>
      <div className="w-48">
        <Select id="sort" label="Urutkan" hideLabel value={value} options={options} onValueChange={apply} />
      </div>
    </div>
  );
}
