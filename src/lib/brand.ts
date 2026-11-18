// Bentuk logo toko dalam satu tempat. Dipakai komponen <BrandMark> di website
// dan generator invoice PDF, supaya keduanya selalu menggambar logo yang sama.
// Kalau logo diganti, cukup ubah path di sini.

export const BRAND_MARK = {
  /** Lebar dan tinggi kanvas path (viewBox SVG). */
  width: 40,
  height: 28,
  /** Langkah pertama (kiri), digambar dengan warna teks. */
  stepLeft: 'M3 22L11.5 5H18.5L13.5 15H19.5L16.5 22H3Z',
  /** Langkah kedua (kanan), digambar dengan warna aksen. */
  stepRight: 'M19.5 22L28 5H35.5L27 22H19.5Z',
  /** Garis sol di bawah kedua langkah. */
  sole: 'M2 25.5H36.5',
  soleWidth: 2.2,
} as const;

export const BRAND_COLORS = {
  ink: '#111111',
  accent: '#007D48',
  accentOnDark: '#16B978',
} as const;
