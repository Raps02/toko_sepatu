// Pelacakan paket SIMULASI.
//
// Toko belum tersambung ke layanan lacak resi (Binderbyte, Biteship, dll.), jadi
// perjalanan paket dibuat dari data pesanan: waktu dikirim, kurir, dan kota
// tujuan. Kabar perjalanan muncul satu per satu seiring waktu seperti resi
// sungguhan, dan selalu sama untuk pesanan yang sama.
//
// Saat nanti memakai layanan sungguhan, cukup ganti isi trackShipment() dengan
// panggilan API-nya; bentuk hasilnya (ShipmentTracking) tetap.

export type TrackingInput = {
  orderNumber: string;
  courier: string;
  trackingNumber: string;
  shippedAt: Date | string;
  recipient: string;
  city: string;
  province: string;
};

export type TrackingEvent = {
  id: string;
  /** Waktu kejadian (ISO). */
  at: string;
  title: string;
  location: string;
  delivered: boolean;
};

export type ShipmentTracking = {
  /** Kabar yang sudah terjadi, terbaru dulu. */
  events: TrackingEvent[];
  delivered: boolean;
  /** Perkiraan paket sampai (ISO). */
  estimatedArrival: string;
  /** "simulasi" sampai toko memakai layanan lacak resi sungguhan. */
  source: 'simulasi';
};

/** Kota asal paket: gudang toko (lihat STORE_CONTACT di site.ts). */
export const ORIGIN_CITY = 'Jakarta Selatan';

const HOUR = 60 * 60 * 1000;

type Step = { afterHours: number; title: string; location: string; delivered?: boolean };

function plan({ courier, recipient, city, province }: TrackingInput): Step[] {
  const sameArea = province.trim().toLowerCase() === 'dki jakarta';
  if (sameArea) {
    return [
      { afterHours: 0, title: `Paket diserahkan Langkah Kaki ke kurir ${courier}`, location: ORIGIN_CITY },
      { afterHours: 1, title: `Paket diterima di gerai ${courier}`, location: ORIGIN_CITY },
      { afterHours: 3, title: 'Paket diproses di gudang sortir', location: 'Jakarta' },
      { afterHours: 5, title: 'Paket dibawa kurir menuju alamat penerima', location: city },
      { afterHours: 8, title: `Paket diterima oleh ${recipient}`, location: city, delivered: true },
    ];
  }
  return [
    { afterHours: 0, title: `Paket diserahkan Langkah Kaki ke kurir ${courier}`, location: ORIGIN_CITY },
    { afterHours: 2, title: `Paket diterima di gerai ${courier}`, location: ORIGIN_CITY },
    { afterHours: 6, title: 'Paket diproses di gudang sortir', location: 'Jakarta' },
    { afterHours: 10, title: `Paket berangkat menuju ${province}`, location: 'Jakarta' },
    { afterHours: 26, title: `Paket tiba di gudang ${courier} kota tujuan`, location: city },
    { afterHours: 32, title: 'Paket dibawa kurir menuju alamat penerima', location: city },
    { afterHours: 37, title: `Paket diterima oleh ${recipient}`, location: city, delivered: true },
  ];
}

/** Angka 0..1 yang tetap untuk teks yang sama, supaya jeda antar kabar tiap pesanan sedikit berbeda. */
function seeded(text: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

/**
 * Tempo simulasi:
 * - demo: tiap kabar baru muncul 5-10 detik setelah kabar sebelumnya (perjalanan selesai dalam kurang dari semenit).
 * - realtime: mengikuti jam perjalanan di plan(); `speed` 60 berarti satu jam berlalu dalam satu menit.
 */
export type TrackingPace = { mode: 'demo' } | { mode: 'realtime'; speed: number };

const DEMO_STEP_SECONDS = { min: 5, max: 10 };

/** Perjalanan paket simulasi sampai waktu `now`. */
export function trackShipment(
  input: TrackingInput,
  now: Date | number = Date.now(),
  pace: TrackingPace = { mode: 'demo' },
): ShipmentTracking {
  const start = new Date(input.shippedAt).getTime();
  const nowMs = typeof now === 'number' ? now : now.getTime();

  let demoOffset = 0;
  const timed = plan(input).map((step, index) => {
    const roll = seeded(input.orderNumber, index);
    if (pace.mode === 'demo') {
      if (index > 0) demoOffset += (DEMO_STEP_SECONDS.min + roll * (DEMO_STEP_SECONDS.max - DEMO_STEP_SECONDS.min)) * 1000;
      return { ...step, at: start + demoOffset, index };
    }
    // Tiap langkah digeser 0-45 menit secara acak-tetap, tanpa pernah melewati langkah berikutnya.
    const jitter = index === 0 ? 0 : roll * 0.75;
    const rate = pace.speed > 0 ? pace.speed : 1;
    return { ...step, at: start + ((step.afterHours + jitter) * HOUR) / rate, index };
  });

  const happened = timed.filter((step) => step.at <= nowMs);
  return {
    events: happened
      .map((step) => ({
        id: `${input.trackingNumber}-${step.index}`,
        at: new Date(step.at).toISOString(),
        title: step.title,
        location: step.location,
        delivered: Boolean(step.delivered),
      }))
      .toReversed(),
    delivered: happened.some((step) => step.delivered),
    estimatedArrival: new Date(timed[timed.length - 1]!.at).toISOString(),
    source: 'simulasi',
  };
}

/**
 * Tempo dari env: TRACKING_SIM_PACE="demo" (default) atau "realtime",
 * dengan TRACKING_SIM_SPEED sebagai pengali untuk mode realtime.
 */
export function trackingPace(): TrackingPace {
  if (process.env.TRACKING_SIM_PACE !== 'realtime') return { mode: 'demo' };
  const speed = Number(process.env.TRACKING_SIM_SPEED);
  return { mode: 'realtime', speed: Number.isFinite(speed) && speed > 0 ? speed : 1 };
}
