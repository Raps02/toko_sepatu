import { expect, test } from '@playwright/test';
import { ACCOUNTS, addKotaLowToCart, login } from './helpers';

test.describe('Belanja', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.customer);
  });

  test('katalog → detail produk → keranjang, lalu item bisa dihapus', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: /Semua Sepatu/ })).toBeVisible();

    await page.getByRole('link', { name: 'Kota Low' }).first().click();
    await expect(page).toHaveURL(/\/products\/kota-low$/);

    await addKotaLowToCart(page);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Keranjang Belanja' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kota Low' })).toBeVisible();

    await page.getByRole('button', { name: 'Hapus' }).click();
    await expect(page.getByRole('heading', { name: 'Keranjangmu Masih Kosong' })).toBeVisible();
  });

  test('checkout sampai pesanan dibayar (mode uji coba)', async ({ page }) => {
    // Alur terpanjang (keranjang → checkout → bayar → invoice) dan pertama kali meng-compile
    // halaman pesanan di dev server, jadi batas waktunya dilonggarkan 3×.
    test.slow();
    await addKotaLowToCart(page);

    await page.goto('/cart');
    await page.getByRole('link', { name: 'Lanjut ke Pengiriman' }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    // Customer demo punya satu alamat default (Jakarta), jadi sudah terpilih dan ongkirnya terhitung.
    await expect(page.getByRole('radio', { checked: true })).toBeVisible();
    // Satu pasang: ongkir DKI Jakarta dari seed tetap dibayar.
    await expect(page.getByRole('definition').filter({ hasText: 'Rp 10.000' })).toBeVisible();
    await page.getByRole('button', { name: /Buat Pesanan/ }).click();

    // Pesanan pertama di run ini menunggu dev server meng-compile halaman pesanan.
    await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 45_000 });
    await expect(page.getByText('Menunggu pembayaran', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Tandai dibayar (uji coba)' }).click();
    await expect(page.getByText('Sudah dibayar', { exact: true })).toBeVisible();

    // Invoice dikirim otomatis ke email; di E2E email sengaja belum disetel (BREVO_API_KEY kosong).
    await expect(page.getByText('Invoice dikirim otomatis ke customer@tapak.test')).toBeVisible();
    await page.getByRole('button', { name: 'Kirim invoice ke email' }).click();
    await expect(page.getByText('Pengiriman email belum disetel', { exact: false })).toBeVisible();

    // Nomor pesanan baru memakai awalan toko LK.
    await expect(page.getByText(/LK-\d{6}-[A-Z0-9]{6}/).first()).toBeVisible();

    // "Lihat invoice" membuka PDF di tab baru. Chromium headless tidak punya penampil PDF,
    // jadi di sini PDF-nya tiba sebagai unduhan di tab itu; di browser biasa langsung tampil.
    const [invoiceTab] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Lihat invoice' }).click(),
    ]);
    const pdf = await invoiceTab.waitForEvent('download');
    expect(pdf.url()).toMatch(/^blob:/);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    await invoiceTab.close();
  });

  test('beli 2 pasang dapat gratis ongkir sampai ke pesanan', async ({ page }) => {
    await addKotaLowToCart(page);

    await page.goto('/cart');
    await expect(page.getByText('Tambah 1 pasang lagi untuk gratis ongkir.')).toBeVisible();
    await page.getByRole('button', { name: 'Tambah jumlah Kota Low' }).click();
    await expect(page.getByText('Kamu dapat gratis ongkir untuk pesanan ini.')).toBeVisible();

    await page.getByRole('link', { name: 'Lanjut ke Pengiriman' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('definition').filter({ hasText: /^Gratis$/ })).toBeVisible();
    await page.getByRole('button', { name: /Buat Pesanan/ }).click();

    // Ongkir dihitung ulang di server, bukan dari tampilan checkout.
    await expect(page).toHaveURL(/\/orders\/[^/]+$/);
    await expect(page.getByRole('definition').filter({ hasText: /^Gratis$/ })).toBeVisible();
  });

  test('ganti ukuran langsung di keranjang', async ({ page }) => {
    await addKotaLowToCart(page);
    await page.goto('/cart');

    // Select Arc (Radix): combobox yang membuka daftar role="option".
    const size = page.getByRole('combobox', { name: 'Ukuran Kota Low' });
    await size.click();
    // Pilih ukuran lain yang masih ada stoknya.
    const other = page.locator('[role="option"]:not([data-disabled]):not([data-state="checked"])').first();
    const label = (await other.innerText()).trim();
    expect(label).toMatch(/^Ukuran /);
    await other.click();
    await expect(size).toContainText(label);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Ukuran Kota Low' })).toContainText(label);

    // Bersihkan supaya test lain mulai dari keranjang kosong.
    await page.getByRole('button', { name: 'Hapus' }).click();
    await expect(page.getByRole('heading', { name: 'Keranjangmu Masih Kosong' })).toBeVisible();
  });

  test('Beli Sekarang langsung ke checkout tanpa menyentuh keranjang', async ({ page }) => {
    await page.goto('/products/aero-run-2');
    await page.locator('button[aria-pressed]:not([disabled])', { hasText: / cm$/ }).first().click();
    await page.getByRole('button', { name: 'Tambah jumlah' }).click();
    await page.getByRole('button', { name: 'Beli Sekarang' }).click();

    await expect(page).toHaveURL(/\/checkout\?beli=[^&]+&jumlah=2$/);
    await expect(page.getByText('hanya sepatu ini yang dipesan')).toBeVisible();
    await expect(page.getByText(/Aero Run 2,.*× 2/)).toBeVisible();
    await page.getByRole('button', { name: /Buat Pesanan/ }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/);

    // Keranjang tidak ikut terisi atau terkosongkan.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Keranjangmu Masih Kosong' })).toBeVisible();
  });

  test('ganti warna di keranjang ikut mengganti foto', async ({ page }) => {
    await addKotaLowToCart(page);
    await page.goto('/cart');

    const color = page.getByRole('combobox', { name: 'Warna Kota Low' });
    const next = (await color.innerText()).includes('Putih') ? 'Hitam' : 'Putih';
    await color.click();
    await page.getByRole('option', { name: next }).click();
    await expect(page.getByRole('img', { name: `Kota Low warna ${next}` })).toHaveAttribute('src', new RegExp(`kota-low-${next.toLowerCase()}`));

    await page.getByRole('button', { name: 'Hapus' }).click();
    await expect(page.getByRole('heading', { name: 'Keranjangmu Masih Kosong' })).toBeVisible();
  });

  test('pindah halaman dari checkout minta konfirmasi dulu', async ({ page }) => {
    await page.goto('/products/kota-low');
    await page.locator('button[aria-pressed]:not([disabled])', { hasText: / cm$/ }).first().click();
    await page.getByRole('button', { name: 'Beli Sekarang' }).click();
    await expect(page).toHaveURL(/\/checkout\?beli=/);

    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await nav.getByRole('link', { name: 'Semua Sepatu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pesananmu belum dibuat' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Lanjut bayar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/checkout\?beli=/);

    await nav.getByRole('link', { name: 'Semua Sepatu' }).click();
    await dialog.getByRole('button', { name: 'Lihat yang lain' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});
