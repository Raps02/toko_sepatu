'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, PackageCheck, Truck } from 'lucide-react';
import { CopyButton } from '@/components/arc/copy-button/copy-button';
import { TextMorph } from '@/components/arc/text-morph/text-morph';
import { Timeline } from '@/components/arc/timeline/timeline';
import { Panel } from '@/components/dashboard/Panel';
import { trackShipment, type TrackingInput, type TrackingPace } from '@/lib/tracking';

type Props = {
  input: TrackingInput;
  /** Waktu server saat halaman dirender, supaya render pertama sama di server dan browser. */
  initialNow: number;
  /** Tempo kabar perjalanan (lihat trackingPace di src/lib/tracking.ts). */
  pace: TrackingPace;
  /** Pembeli sudah mengonfirmasi pesanan diterima. */
  received?: boolean;
};

const TIME_ZONE = 'Asia/Jakarta';
const dateTime = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** Lacak paket ala marketplace: kabar terakhir di atas, lalu riwayat perjalanan lengkap. */
export function ShipmentTracking({ input, initialNow, pace, received = false }: Props) {
  const [now, setNow] = useState(initialNow);

  // Kabar baru muncul sendiri tanpa memuat ulang halaman: mode demo dicek tiap detik
  // (kabar datang tiap 5-10 detik), mode realtime cukup tiap 30 detik.
  const tickMs = pace.mode === 'demo' ? 1_000 : 30_000;
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);

  const tracking = useMemo(() => trackShipment(input, now, pace), [input, now, pace]);
  const latest = tracking.events[0];

  return (
    <section aria-label="Lacak paket">
      <Panel
        title={
          <span className="flex items-start gap-2">
            <span className={`mt-0.5 ${tracking.delivered ? 'text-promo-save' : 'text-ink'}`}>
              {tracking.delivered ? <PackageCheck className="h-5 w-5" aria-hidden /> : <Truck className="h-5 w-5" aria-hidden />}
            </span>
            {/* Kabar terbaru berubah huruf demi huruf (TextMorph Arc) setiap ada kabar baru. */}
            <TextMorph>{latest?.title ?? 'Menunggu kabar dari kurir'}</TextMorph>
          </span>
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-studio-line pb-4">
          <div>
            {latest && (
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                <TextMorph>{latest.location}</TextMorph>
              </p>
            )}
            <p className="mt-2 text-sm text-ink-muted">
              {received
                ? 'Pesanan sudah kamu terima. Terima kasih sudah belanja di Langkah Kaki.'
                : tracking.delivered
                  ? 'Kurir mencatat paket sudah sampai. Konfirmasi di bawah kalau sudah kamu terima.'
                  : `Perkiraan tiba ${dateTime.format(new Date(tracking.estimatedArrival))} WIB.`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-ink-muted">
            <p>
              {input.courier}, <span className="tabular font-medium text-ink">{input.trackingNumber}</span>
            </p>
            <CopyButton value={input.trackingNumber} label="Salin resi" />
          </div>
        </div>

        <div className="pt-4">
          <Timeline
          label="Riwayat perjalanan paket"
          now={now}
          timeZone={TIME_ZONE}
          locale="id-ID"
          headingLevel={3}
          maxHeight={360}
          events={tracking.events.map((event) => ({
            id: event.id,
            at: event.at,
            title: event.title,
            meta: event.location,
            tone: event.delivered ? ('success' as const) : ('neutral' as const),
          }))}
        />
        </div>
      </Panel>
    </section>
  );
}
