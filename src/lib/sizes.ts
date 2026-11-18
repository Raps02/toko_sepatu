// Ukuran sepatu di Indonesia memakai angka EU (36, 40, 42, ...), jadi itulah yang
// disimpan di `ProductVariant.size`. Tabel ini dipakai untuk panduan ukuran:
// konversi ke UK/US dan panjang telapak kaki. Angkanya panduan umum; tiap model
// bisa beda setengah ukuran.

export type Gender = 'PRIA' | 'WANITA' | 'UNISEX';

export const GENDER_LABEL: Record<Gender, string> = {
  PRIA: 'Pria',
  WANITA: 'Wanita',
  UNISEX: 'Unisex',
};

/** Nilai `?gender=` di URL katalog. */
export const GENDER_PARAM: Record<'pria' | 'wanita', Gender> = {
  pria: 'PRIA',
  wanita: 'WANITA',
};

export type SizeRow = {
  /** Ukuran Indonesia, sama dengan EU. */
  id: number;
  uk: number;
  usPria: number;
  usWanita: number;
  /** Panjang telapak kaki dalam cm. */
  cm: number;
};

export const SIZE_CHART: SizeRow[] = [
  { id: 35, uk: 2.5, usPria: 3.5, usWanita: 5, cm: 22 },
  { id: 36, uk: 3.5, usPria: 4.5, usWanita: 6, cm: 22.5 },
  { id: 37, uk: 4, usPria: 5, usWanita: 6.5, cm: 23.5 },
  { id: 38, uk: 5, usPria: 6, usWanita: 7.5, cm: 24 },
  { id: 39, uk: 6, usPria: 6.5, usWanita: 8, cm: 24.5 },
  { id: 40, uk: 6.5, usPria: 7, usWanita: 8.5, cm: 25 },
  { id: 41, uk: 7, usPria: 8, usWanita: 9.5, cm: 26 },
  { id: 42, uk: 8, usPria: 8.5, usWanita: 10, cm: 26.5 },
  { id: 43, uk: 9, usPria: 9.5, usWanita: 11, cm: 27.5 },
  { id: 44, uk: 9.5, usPria: 10, usWanita: 11.5, cm: 28 },
  { id: 45, uk: 10.5, usPria: 11, usWanita: 12.5, cm: 29 },
  { id: 46, uk: 11, usPria: 12, usWanita: 13.5, cm: 29.5 },
];

/** Baris tabel untuk satu ukuran, atau null kalau ukurannya bukan angka di tabel (mis. "40.5" atau "S"). */
export function sizeInfo(size: string): SizeRow | null {
  const value = Number(size.trim());
  if (!Number.isFinite(value)) return null;
  return SIZE_CHART.find((row) => row.id === value) ?? null;
}

/** Baris tabel untuk ukuran-ukuran yang dijual sebuah produk, urut dari kecil. */
export function sizeChartFor(sizes: string[]): SizeRow[] {
  const wanted = new Set(sizes.map((s) => sizeInfo(s)?.id).filter((id): id is number => id !== undefined));
  return SIZE_CHART.filter((row) => wanted.has(row.id));
}

/** Ukuran yang cocok untuk panjang kaki tertentu: ukuran terkecil yang panjangnya tidak kurang dari kaki. */
export function suggestSize(footCm: number): SizeRow | null {
  if (!Number.isFinite(footCm) || footCm <= 0) return null;
  return SIZE_CHART.find((row) => row.cm >= footCm) ?? null;
}

/** Ubah `?gender=` dari URL jadi enum, abaikan nilai lain. */
export function parseGenderParam(value: string | undefined): Gender | undefined {
  if (!value) return undefined;
  return GENDER_PARAM[value.toLowerCase() as keyof typeof GENDER_PARAM];
}

/** Urutkan ukuran secara angka ("9" sebelum "10", "40.5" di antara 40 dan 41). */
export function sortSizes(sizes: string[]): string[] {
  return sizes.toSorted((a, b) => {
    const na = Number.parseFloat(a);
    const nb = Number.parseFloat(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b, 'id');
    return na - nb;
  });
}
