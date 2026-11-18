import { expect, test, type Browser, type Page } from '@playwright/test';
import { login } from './helpers';

// Lupa kata sandi, ganti kata sandi, dan ganti email. Di E2E BREVO_API_KEY kosong, jadi link yang
// seharusnya dikirim lewat email tampil di halaman ("Mode development"). Tiap test memakai akun
// baru supaya kata sandi akun seed (dipakai test lain) tidak berubah.

const PASSWORD = 'sandi-lama-123';

async function registerFresh(browser: Browser): Promise<{ page: Page; email: string }> {
  const page = await (await browser.newContext()).newPage();
  const email = `akun-${Date.now()}-${Math.floor(Math.random() * 1e4)}@tapak.test`;
  await page.goto('/register');
  await page.getByLabel('Nama lengkap').fill('Penguji Akun');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/register'));
  return { page, email };
}

async function freshPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test.describe('Akun & kata sandi', () => {
  test.slow();

  test('lupa kata sandi: link dari email membuat kata sandi baru dan mengeluarkan sesi lama', async ({ browser }) => {
    const { page: oldSession, email } = await registerFresh(browser);

    const page = await freshPage(browser);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Lupa kata sandi?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Kirim link atur ulang' }).click();
    await expect(page.getByText(/Kalau email itu terdaftar/)).toBeVisible();

    await page.getByRole('link', { name: 'Buka link dari email' }).click();
    await expect(page.getByRole('heading', { name: 'Buat kata sandi baru' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByLabel('Kata sandi baru', { exact: true }).fill('sandi-baru-456');
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();

    await expect(page).toHaveURL(/\/login\?reset=berhasil$/);
    await expect(page.getByText('Kata sandi baru sudah disimpan.')).toBeVisible();
    await login(page, email, 'sandi-baru-456');
    await expect(page).toHaveURL('/');

    // Sesi di perangkat lain (dari sebelum reset) sudah keluar.
    await oldSession.goto('/account');
    await expect(oldSession).toHaveURL(/\/login\?sesi=berakhir$/);
    await expect(oldSession.getByText('Sesimu sudah berakhir')).toBeVisible();
    await login(oldSession, email, 'sandi-baru-456');
    await expect(oldSession).toHaveURL('/');
  });

  test('email yang tidak terdaftar mendapat jawaban yang sama, tanpa link', async ({ browser }) => {
    const page = await freshPage(browser);
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('tidak-ada@tapak.test');
    await page.getByRole('button', { name: 'Kirim link atur ulang' }).click();
    await expect(page.getByText(/Kalau email itu terdaftar/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Buka link dari email' })).toHaveCount(0);
  });

  test('link atur ulang yang salah atau sudah dipakai ditolak', async ({ browser }) => {
    const page = await freshPage(browser);
    await page.goto('/reset-password?token=token-palsu-yang-tidak-ada');
    await expect(page.getByRole('heading', { name: 'Link tidak berlaku' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Minta link baru' })).toBeVisible();
  });

  test('ganti kata sandi dari halaman Akun', async ({ browser }) => {
    const { page, email } = await registerFresh(browser);
    await page.goto('/account');

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ganti kata sandi' }) });
    await form.getByLabel('Kata sandi saat ini', { exact: true }).fill('salah-banget');
    await form.getByLabel('Kata sandi baru', { exact: true }).fill('sandi-akun-789');
    await form.getByRole('button', { name: 'Ganti kata sandi' }).click();
    await expect(form.getByText('Kata sandi saat ini salah.')).toBeVisible();

    await form.getByLabel('Kata sandi saat ini', { exact: true }).fill(PASSWORD);
    await form.getByRole('button', { name: 'Ganti kata sandi' }).click();
    // Perangkat ini tetap masuk dengan sesi baru.
    await expect(page).toHaveURL(/\/account\?berhasil=password$/);
    await expect(page.getByText('Kata sandi disimpan.')).toBeVisible();

    const other = await freshPage(browser);
    await login(other, email, 'sandi-akun-789');
    await expect(other).toHaveURL('/');
  });

  test('ganti email lewat link konfirmasi ke email baru', async ({ browser }) => {
    const { page } = await registerFresh(browser);
    const newEmail = `baru-${Date.now()}@tapak.test`;
    await page.goto('/account');

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Kirim link konfirmasi' }) });
    await form.getByLabel('Email baru').fill(newEmail);
    await form.getByLabel('Kata sandi saat ini', { exact: true }).fill(PASSWORD);
    await form.getByRole('button', { name: 'Kirim link konfirmasi' }).click();
    await expect(form.getByText(`Link konfirmasi sudah dikirim ke ${newEmail}.`, { exact: false })).toBeVisible();

    await form.getByRole('link', { name: 'Buka link dari email' }).click();
    await expect(page.getByRole('heading', { name: 'Konfirmasi email baru' })).toBeVisible();
    await page.getByRole('button', { name: 'Konfirmasi email baru' }).click();
    await expect(page.getByRole('heading', { name: 'Email berhasil diganti' })).toBeVisible();
    // Link yang sama tidak bisa dipakai dua kali.
    await page.goBack();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Link tidak berlaku' })).toBeVisible();

    const other = await freshPage(browser);
    await login(other, newEmail, PASSWORD);
    await expect(other).toHaveURL('/');
  });
});
