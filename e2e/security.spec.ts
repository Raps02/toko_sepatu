import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

async function tryLogin(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('kata-sandi-salah');
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/login')),
    page.getByRole('button', { name: 'Masuk', exact: true }).click(),
  ]);
}

test.describe('Keamanan', () => {
  test('login dihentikan setelah terlalu banyak percobaan salah', async ({ page }) => {
    test.setTimeout(90_000);
    const email = `tebakan-${Date.now()}@tapak.test`;
    await page.goto('/login');
    for (let attempt = 0; attempt < 8; attempt++) await tryLogin(page, email);
    await expect(page.getByRole('alert').filter({ hasText: 'Email atau password salah' })).toBeVisible();

    await tryLogin(page, email);
    await expect(page.getByRole('alert').filter({ hasText: 'Terlalu banyak percobaan masuk' })).toBeVisible();
  });

  test('halaman memakai header keamanan', async ({ request }) => {
    const response = await request.get('/login');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('satu akun tidak bisa menahan stok lewat banyak order belum dibayar', async ({ page }) => {
    test.setTimeout(120_000);
    const email = `penahan-${Date.now()}@tapak.test`;
    await page.goto('/register');
    await page.getByLabel('Nama lengkap').fill('Penguji Stok');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('sandi-uji-123');
    await page.getByRole('button', { name: 'Daftar', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/register'));

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.address.create({
      data: { userId: user.id, label: 'Rumah', recipient: 'Penguji', phone: '081234567890', street: 'Jl. Uji 1', city: 'Jakarta', province: 'DKI Jakarta', postalCode: '10110', isDefault: true },
    });
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { isActive: true, stock: { gte: 4 }, product: { slug: 'derby-kulit' } },
    });

    for (let order = 0; order < 3; order++) {
      await page.goto(`/checkout?beli=${variant.id}&jumlah=1`);
      await page.getByRole('button', { name: /Buat Pesanan/ }).click();
      await page.waitForURL(/\/orders\/[^/]+$/);
    }

    await page.goto(`/checkout?beli=${variant.id}&jumlah=1`);
    await page.getByRole('button', { name: /Buat Pesanan/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'belum dibayar' })).toBeVisible();
    await expect(prisma.order.count({ where: { userId: user.id } })).resolves.toBe(3);
  });
});
