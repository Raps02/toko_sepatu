import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, login } from './helpers';

test.describe('Autentikasi', () => {
  test('customer bisa login dan masuk ke beranda toko', async ({ page }) => {
    await login(page, ACCOUNTS.customer);

    await expect(page).toHaveURL('/');
    // Bukti sesi aktif: halaman khusus customer tidak lagi melempar ke /login.
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/cart$/);
  });

  test('password salah menampilkan pesan error dan tetap di halaman login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.customer);
    await page.getByLabel('Password').fill('password-salah');
    await page.getByRole('button', { name: 'Masuk' }).click();

    await expect(page.getByText('Email atau password salah.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('pengunjung yang belum login diarahkan ke /login saat membuka keranjang', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login/);
  });

  test('pendaftaran akun baru langsung masuk sebagai customer', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Nama lengkap').fill('Penguji E2E');
    await page.getByLabel('Email').fill(`e2e-${Date.now()}@tapak.test`);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Daftar' }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/register'));
    await expect(page).toHaveURL('/');
  });

  // Login Google tidak bisa dites sungguhan di E2E (butuh akun Google). Logika cek/sambung/buat
  // akunnya dites di src/lib/google-auth.test.ts; di sini cukup tampilan tombol dan pesan penolakan.
  test('tanpa AUTH_GOOGLE_ID tombol Google tidak tampil', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Masuk dengan Google' })).toHaveCount(0);
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Daftar dengan Google' })).toHaveCount(0);
  });

  test('login Google yang ditolak menampilkan alasannya di halaman login', async ({ page }) => {
    await page.goto('/login?error=google-staff');
    await expect(page.getByRole('alert')).toHaveText('Akun staf masuk lewat email dan password, bukan Google.');
    // Kode error NextAuth lain (mis. login dibatalkan di Google) memakai pesan umum.
    await page.goto('/login?error=OAuthCallbackError');
    await expect(page.getByRole('alert')).toHaveText('Masuk dengan Google gagal. Coba lagi sebentar lagi.');
  });
});
