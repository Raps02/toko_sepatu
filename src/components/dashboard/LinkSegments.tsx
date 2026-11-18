'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';

/** SegmentedControl Arc untuk pilihan yang tersimpan di URL, mis. saringan daftar. */
export function LinkSegments({
  label,
  options,
  active,
}: {
  label: string;
  options: { href: string; label: string; count?: number }[];
  active: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(active);

  return (
    <SegmentedControl
      label={label}
      value={value}
      options={options.map((option) => ({
        value: option.href,
        label: option.label,
        accessory: option.count === undefined ? undefined : <span className="tabular text-xs text-ink-muted">{option.count}</span>,
      }))}
      onValueChange={(href) =>
        startTransition(() => {
          setValue(href);
          router.push(href, { scroll: false });
        })
      }
    />
  );
}
