import { describe, expect, it } from 'vitest';
import { imageForColor, imageIndexForColor } from './product-images';

const images = [
  { url: '/images/products/kota-platform-putih.jpg' },
  { url: '/images/products/kota-platform-krem.jpg' },
];

describe('imageForColor', () => {
  it('memilih foto yang nama filenya memuat warna', () => {
    expect(imageForColor(images, 'Krem')?.url).toContain('-krem.jpg');
    expect(imageIndexForColor(images, 'Putih')).toBe(0);
  });

  it('mendukung warna dua kata', () => {
    const heels = [{ url: '/x/anggun-block-heel-hitam.jpg' }, { url: '/x/anggun-block-heel-merah-marun.jpg' }];
    expect(imageForColor(heels, 'Merah Marun')?.url).toContain('merah-marun');
  });

  it('tidak salah cocok dengan potongan kata lain', () => {
    // "putih" tidak boleh cocok dengan "putihan".
    const aero = [{ url: '/x/aero-run-2-hitam.jpg' }, { url: '/x/aero-run-2-biru-laut.jpg' }];
    expect(imageForColor(aero, 'Biru Laut')?.url).toContain('biru-laut');
    expect(imageIndexForColor([{ url: '/x/sepatu-putihan.jpg' }, { url: '/x/sepatu-putih.jpg' }], 'Putih')).toBe(1);
  });

  it('jatuh ke foto pertama kalau tidak ada yang cocok, undefined kalau tidak ada foto', () => {
    expect(imageIndexForColor([{ url: '/uploads/a1b2c3.jpg' }, { url: '/uploads/d4e5.jpg' }], 'Hitam')).toBe(0);
    expect(imageForColor([], 'Hitam')).toBeUndefined();
  });
});
