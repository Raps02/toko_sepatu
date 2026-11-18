import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('Stok dan harga modal', () => {
  test('harga modal tidak diisi di barang masuk, untuk siapa pun', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/dashboard/stock');
    await expect(page.getByRole('heading', { name: 'Barang masuk' })).toBeVisible();
    await expect(page.getByLabel(/modal/i)).toHaveCount(0);
    await expect(page.getByText(/Modal Rp/)).toHaveCount(0);
  });

  test('admin melihat modal di daftar produk, SPV tidak', async ({ browser }) => {
    const admin = await browser.newPage();
    await login(admin, ACCOUNTS.admin);
    await admin.goto('/dashboard/products');
    await expect(admin.getByRole('columnheader', { name: 'Modal' })).toBeVisible();
    await admin.goto('/dashboard/products/new');
    await expect(admin.getByLabel('Harga modal per pasang (Rp)')).toBeVisible();
    await admin.close();

    const spv = await browser.newPage();
    await login(spv, ACCOUNTS.spv);
    await spv.goto('/dashboard/products');
    await expect(spv.getByRole('heading', { level: 1, name: 'Produk' })).toBeVisible();
    await expect(spv.getByRole('columnheader', { name: 'Modal' })).toHaveCount(0);
    await spv.goto('/dashboard/reports');
    await expect(spv.getByText(/Laba kotor/i)).toHaveCount(0);
    await spv.close();
  });

  test('produk baru dari SPV masuk sebagai draf tanpa tombol hapus', async ({ page }) => {
    await login(page, ACCOUNTS.spv);
    await page.goto('/dashboard/products/new');
    await expect(page.getByLabel('Harga modal per pasang (Rp)')).toHaveCount(0);
    await expect(page.getByText('Produk disimpan sebagai draf.')).toBeVisible();

    await page.getByLabel('Nama produk').fill('Uji Draf SPV');
    await page.getByLabel('Merek').fill('Tapak');
    await page.getByLabel('Harga jual (Rp)').fill('500000');
    await page.getByRole('button', { name: 'Simpan produk' }).click();

    await page.waitForURL(/\/dashboard\/products\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Uji Draf SPV' })).toBeVisible();
    await expect(page.getByText('Draf', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hapus produk ini' })).toHaveCount(0);
  });

  test('riwayat stok bisa difilter menurut jenis dan produk', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/dashboard/stock');

    const filter = page.getByRole('search', { name: 'Filter riwayat stok' });
    await filter.getByRole('combobox', { name: 'Jenis' }).click();
    await page.getByRole('option', { name: 'Barang masuk' }).click();
    await filter.getByRole('combobox', { name: 'Produk' }).click();
    await page.getByRole('option', { name: 'Kota Low' }).click();
    await filter.getByRole('button', { name: 'Terapkan filter' }).click();

    await expect(page).toHaveURL(/type=IN/);
    const rows = page.locator('#riwayat-stok tbody tr');
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row).toContainText('Kota Low');
      await expect(row).toContainText('Barang masuk');
    }

    await page.getByRole('link', { name: 'Hapus filter' }).click();
    await expect(page).not.toHaveURL(/type=/);
  });
});
