// Toko beroperasi di WIB. Semua tanggal ditampilkan dan laporan harian
// dipotong berdasarkan zona ini, di mana pun server berjalan.
export const APP_TIMEZONE = 'Asia/Jakarta';
const WIB_OFFSET = '+07:00';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(amount: number): string {
  return rupiah.format(amount).replace(/ /g, ' ');
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  });
}

/** Tanggal hari ini di WIB dalam bentuk YYYY-MM-DD. */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** Tanggal (WIB) dari sebuah waktu dalam bentuk YYYY-MM-DD. */
export function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Rentang waktu [start, end) yang mencakup tanggal `from` sampai `to` (WIB, inklusif). */
export function dayRange(from: string, to: string = from): { start: Date; end: Date } {
  const start = new Date(`${from}T00:00:00${WIB_OFFSET}`);
  const end = new Date(new Date(`${to}T00:00:00${WIB_OFFSET}`).getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
