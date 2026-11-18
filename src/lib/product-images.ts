import { slugify } from '@/lib/format';

/**
 * Foto yang paling cocok untuk sebuah warna: foto yang nama filenya memuat warna itu
 * (mis. `senja-flat-nude.jpg` untuk "Nude"). Kalau tidak ada yang cocok, foto pertama.
 * Foto yang diunggah lewat dashboard bernama acak, jadi selalu jatuh ke foto pertama.
 */
export function imageIndexForColor(images: readonly { url: string }[], color: string): number {
  const token = slugify(color);
  if (!token) return 0;
  // Cocokkan sebagai bagian nama file utuh: "-putih." atau "-putih-", supaya
  // warna pendek tidak nyasar ke kata lain di nama file.
  const pattern = new RegExp(`(^|[/-])${token}([-.]|$)`);
  const index = images.findIndex((image) => pattern.test(image.url.toLowerCase()));
  return Math.max(index, 0);
}

export function imageForColor<T extends { url: string }>(images: readonly T[], color: string): T | undefined {
  return images[imageIndexForColor(images, color)];
}
