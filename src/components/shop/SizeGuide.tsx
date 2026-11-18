'use client';

import { useState } from 'react';
import { DataTable } from '@/components/dashboard/DataTable';
import { Disclosure } from '@/components/dashboard/Disclosure';
import { TextField } from '@/components/ui/Field';
import { type Gender, sizeChartFor, suggestSize } from '@/lib/sizes';

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

type Props = {
  /** Ukuran yang dijual produk ini. */
  sizes: string[];
  gender: Gender;
};

export function SizeGuide({ sizes, gender }: Props) {
  const [foot, setFoot] = useState('');
  const rows = sizeChartFor(sizes);
  if (rows.length === 0) return null;

  const showPria = gender !== 'WANITA';
  const showWanita = gender !== 'PRIA';

  const footCm = Number.parseFloat(foot.replace(',', '.'));
  const suggestion = foot ? suggestSize(footCm) : null;
  const sold = suggestion ? rows.some((r) => r.id === suggestion.id) : false;

  return (
    <div className="mt-3">
      <Disclosure title="Panduan Ukuran">
        <div className="space-y-4">
          <div>
            <TextField
              id="foot-length"
              label="Panjang telapak kaki kamu (cm)"
              name="foot"
              inputMode="decimal"
              value={foot}
              onChange={(event) => setFoot(event.target.value)}
              placeholder="Misal: 24,5"
              wrapperClassName="max-w-56"
            />
            <p className="mt-1.5 min-h-5 text-sm text-ink" aria-live="polite">
              {!foot
                ? ''
                : !suggestion
                  ? 'Panjang kaki di luar tabel ukuran kami.'
                  : sold
                    ? `Saran: ukuran ${suggestion.id} (${fmt(suggestion.cm)} cm).`
                    : `Saran: ukuran ${suggestion.id}, tapi model ini tidak tersedia di ukuran itu.`}
            </p>
            <p className="text-xs text-ink-muted">Ukur dari tumit ke ujung jari terpanjang sambil berdiri. Kalau di antara dua ukuran, pilih yang lebih besar.</p>
          </div>

          <DataTable
            caption="Konversi ukuran sepatu untuk model ini"
            columns={[
              { key: 'id', label: 'ID/EU' },
              { key: 'cm', label: 'Kaki (cm)', numeric: true },
              { key: 'uk', label: 'UK', numeric: true },
              ...(showPria ? [{ key: 'pria', label: 'US Pria', numeric: true }] : []),
              ...(showWanita ? [{ key: 'wanita', label: 'US Wanita', numeric: true }] : []),
            ]}
            rows={rows.map((row) => ({
              id: String(row.id),
              cells: {
                id: <span className={suggestion?.id === row.id ? 'font-semibold' : undefined}>{row.id}</span>,
                cm: fmt(row.cm),
                uk: fmt(row.uk),
                pria: fmt(row.usPria),
                wanita: fmt(row.usWanita),
              },
            }))}
          />
          <p className="text-xs text-ink-muted">Ukuran di toko ini memakai standar Indonesia (sama dengan EU).</p>
        </div>
      </Disclosure>
    </div>
  );
}
