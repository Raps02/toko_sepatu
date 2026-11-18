import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('Akun staf', () => {
  test('admin menghapus akun tanpa riwayat lalu kembali ke daftar akun', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, ACCOUNTS.admin);
    await page.goto('/dashboard/users');

    await page.getByLabel('Nama', { exact: true }).fill('Akun Sementara');
    await page.getByLabel('Email', { exact: true }).fill('sementara@tapak.test');
    await page.getByLabel('Password awal').fill('password123');
    await page.getByRole('button', { name: 'Buat akun' }).click();
    await expect(page.getByText('Akun sementara@tapak.test dibuat.')).toBeVisible();

    await page.getByRole('link', { name: 'Akun Sementara' }).click();
    await page.waitForURL(/\/dashboard\/users\/[^/?]+$/, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Hapus akun ini' }).click();
    await page.getByRole('button', { name: 'Ya, hapus' }).click();

    await expect(page).toHaveURL(/\/dashboard\/users\?dihapus=/);
    await expect(page.getByRole('status').filter({ hasText: 'Akun sementara@tapak.test dihapus.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Akun Sementara' })).toHaveCount(0);
  });

  test('akun yang punya riwayat kerja tidak bisa dihapus', async ({ browser }) => {
    test.setTimeout(120_000);
    // SPV mencatat satu tindakan (membuat produk draf), jadi namanya masuk riwayat perubahan.
    const spv = await browser.newPage();
    await login(spv, ACCOUNTS.spv);
    await spv.goto('/dashboard/products/new');
    await spv.getByLabel('Nama produk').fill('Uji Riwayat SPV');
    await spv.getByLabel('Merek').fill('Tapak');
    await spv.getByLabel('Harga jual (Rp)').fill('400000');
    await spv.getByRole('button', { name: 'Simpan produk' }).click();
    await spv.waitForURL(/\/dashboard\/products\/[^/]+$/, { timeout: 60_000 });
    await spv.close();

    const admin = await browser.newPage();
    await login(admin, ACCOUNTS.admin);
    await admin.goto('/dashboard/users');
    await admin.getByRole('link', { name: 'Supervisor Toko' }).click();
    await admin.waitForURL(/\/dashboard\/users\/[^/?]+$/, { timeout: 60_000 });
    await expect(admin.getByText(/tindakan di riwayat perubahan/)).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Hapus akun ini' })).toHaveCount(0);
    await admin.close();
  });
});
