'use client';

import { useState, type ReactNode } from 'react';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Panel } from '@/components/dashboard/Panel';

export type BreakdownRow = { key: string; label: string; value: number };
export type BreakdownView = { value: string; label: string; rows: BreakdownRow[]; valueLabel: string };

/**
 * Kartu rincian: daftar baris dengan batang proporsional di belakangnya.
 * Kalau ada lebih dari satu sudut pandang, pengalihnya SegmentedControl Arc.
 */
export function BreakdownCard({
  title,
  note,
  views,
  empty,
}: {
  title: string;
  note?: string;
  views: BreakdownView[];
  empty: ReactNode;
}) {
  const [active, setActive] = useState(views[0]!.value);
  const view = views.find((v) => v.value === active) ?? views[0]!;
  const max = Math.max(1, ...view.rows.map((row) => row.value));

  return (
    <Panel
      title={title}
      description={note}
      className="h-full"
      aside={
        views.length > 1 ? (
          <SegmentedControl
            label={`Tampilkan ${title.toLowerCase()} menurut`}
            options={views.map(({ value, label }) => ({ value, label }))}
            value={active}
            onValueChange={setActive}
          />
        ) : undefined
      }
    >
      {view.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">{empty}</p>
      ) : (
        <>
          <div className="flex justify-between pb-1.5 text-xs text-ink-muted">
            <span>{view.label}</span>
            <span>{view.valueLabel}</span>
          </div>
          <ol className="-mx-2 space-y-1">
            {view.rows.map((row) => (
              <li key={row.key} className="relative flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-lg bg-court-tint transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
                <span className="relative truncate text-ink">{row.label}</span>
                <span className="tabular relative shrink-0 font-medium text-ink">{row.value.toLocaleString('id-ID')}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
