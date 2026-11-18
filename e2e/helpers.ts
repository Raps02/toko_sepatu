import { expect, type Page } from '@playwright/test';

// Akun dari prisma/seed.ts. Semuanya memakai password yang sama.
export const PASSWORD = 'password123';
export const ACCOUNTS = {
  admin: 'admin@tapak.test',
  spv: 'spv@tapak.test',
  customer: 'customer@tapak.test',
} as const;

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Membuka halaman Kota Low, memilih ukuran pertama yang tersedia, lalu memasukkannya ke keranjang. */
export async function addKotaLowToCart(page: Page) {
  await page.goto('/products/kota-low');
  await page.locator('button[aria-pressed]:not([disabled])', { hasText: / cm$/ }).first().click();
  await page.getByRole('button', { name: 'Masukkan Keranjang' }).click();
  // Tunggu konfirmasi dari server sebelum pindah halaman.
  await expect(page.getByRole('status').filter({ hasText: 'masuk keranjang' })).toBeVisible();
}
