import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

// Di E2E bot sengaja mati (OPENAI_API_KEY kosong di .env.e2e), jadi yang dites adalah
// widget, penyerahan ke staf, dan balasan staf yang sampai ke pembeli.

test.describe('Chat melayang', () => {
  test('pengunjung diminta masuk dulu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Buka chat toko' }).click();

    const chat = page.getByRole('dialog', { name: 'Chat dengan toko' });
    await expect(chat.getByRole('link', { name: 'Masuk untuk Chat' })).toBeVisible();
  });

  test('pesan pembeli masuk ke dashboard sebagai butuh staf, balasan staf sampai ke widget', async ({ browser }) => {
    // Dua sesi login + menunggu widget memuat ulang (tiap 5 detik): lebih lama dari test biasa.
    test.setTimeout(60_000);
    const customer = await browser.newPage();
    await login(customer, ACCOUNTS.customer);

    // Dibuka dari tombol di halaman produk.
    await customer.goto('/products/kota-low');
    await customer.getByRole('button', { name: 'Tanya Toko Soal Sepatu Ini' }).click();
    const chat = customer.getByRole('dialog', { name: 'Chat dengan toko' });
    await expect(chat.getByText('Staf toko akan membalas di jam kerja')).toBeVisible();

    await chat.getByLabel('Pesan', { exact: true }).fill('Kota Low ukuran 41 warna hitam masih ada?');
    await chat.getByRole('button', { name: 'Kirim pesan' }).click();
    await expect(chat.getByText('Kota Low ukuran 41 warna hitam masih ada?')).toBeVisible();

    const admin = await browser.newPage();
    await login(admin, ACCOUNTS.admin);
    await admin.goto('/dashboard/chat');
    await expect(admin.getByText('Butuh staf').first()).toBeVisible();
    await admin.getByRole('link', { name: 'Budi Pembeli' }).click();
    // Halaman detail baru dikompilasi saat pertama dibuka di server dev; tunggu navigasinya.
    await admin.waitForURL(/\/dashboard\/chat\/[^/]+$/);

    await admin.getByLabel('Pesan', { exact: true }).fill('Masih ada kak, tinggal 2 pasang.');
    await admin.getByRole('button', { name: 'Kirim' }).click();
    await expect(admin.getByText('Masih ada kak, tinggal 2 pasang.')).toBeVisible();

    // Widget memuat ulang tiap 5 detik selama terbuka.
    await expect(chat.getByText('Masih ada kak, tinggal 2 pasang.')).toBeVisible({ timeout: 15_000 });
    await expect(chat.getByText('Admin Toko · Toko', { exact: true })).toBeVisible();
  });
});
