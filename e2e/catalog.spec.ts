import { expect, test } from '@playwright/test';

test.describe('Katalog pria/wanita & panduan ukuran', () => {
  test('filter Wanita menampilkan produk wanita dan unisex, tanpa produk pria', async ({ page }) => {
    await page.goto('/products?gender=wanita');

    await expect(page.getByRole('heading', { level: 1, name: /Sepatu Wanita/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Senja Flat' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kota Low' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Derby Kulit' })).toHaveCount(0);
  });

  test('filter Pria tidak menampilkan produk wanita', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('group', { name: 'Sepatu untuk' }).getByRole('button', { name: 'Pria' }).click();

    await expect(page).toHaveURL(/gender=pria/);
    await expect(page.getByRole('link', { name: 'Derby Kulit' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Senja Flat' })).toHaveCount(0);
  });

  test('panduan ukuran menyarankan ukuran dari panjang kaki', async ({ page }) => {
    await page.goto('/products/senja-flat');

    await page.getByText('Panduan Ukuran').click();
    await expect(page.getByRole('columnheader', { name: 'US Wanita' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'US Pria' })).toHaveCount(0);

    await page.getByLabel('Panjang telapak kaki kamu (cm)').fill('23,5');
    await expect(page.getByText('Saran: ukuran 37 (23,5 cm).')).toBeVisible();
  });

  test('filter aktif bisa dilepas satu per satu, jumlah per kegunaan ikut filter', async ({ page }) => {
    await page.goto('/products?gender=wanita&category=kasual');

    // Seed: produk wanita/unisex kasual = Senja Flat, Kota Platform, Kota Low.
    const kegunaan = page.getByRole('complementary').getByRole('navigation', { name: 'Kegunaan' });
    await expect(kegunaan.getByRole('link', { name: /Kasual\s*3/ })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'Lepas filter Wanita' }).click();
    await expect(page).toHaveURL(/\/products\?category=kasual$/);
    await expect(page.getByRole('link', { name: 'Lepas filter Kasual' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lepas filter Wanita' })).toHaveCount(0);
  });
});
