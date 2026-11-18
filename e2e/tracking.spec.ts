import { expect, test } from '@playwright/test';
import { ACCOUNTS, addKotaLowToCart, login } from './helpers';

// Alur pengiriman: staf mengisi kurir + resi, pembeli melihat lacak paket (simulasi tempo
// demo: kabar baru tiap 5-10 detik, src/lib/tracking.ts), menyalin resi, lalu mengonfirmasi
// lewat dialog Arc. Retur baru terbuka setelah pesanan dikonfirmasi diterima.

test('pembeli melacak paket lalu mengonfirmasi pesanan diterima', async ({ browser }) => {
  // Dua sesi login dan beberapa halaman yang di-compile pertama kali.
  test.setTimeout(210_000);

  const customerContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const customer = await customerContext.newPage();
  await login(customer, ACCOUNTS.customer);
  await addKotaLowToCart(customer);
  await customer.goto('/checkout');
  await customer.getByRole('button', { name: /Buat Pesanan/ }).click();
  await expect(customer).toHaveURL(/\/orders\/[^/]+$/, { timeout: 30_000 });
  const orderId = new URL(customer.url()).pathname.split('/').pop()!;
  await customer.getByRole('button', { name: 'Tandai dibayar (uji coba)' }).click();
  await expect(customer.getByText('Sudah dibayar', { exact: true })).toBeVisible();

  const admin = await browser.newPage();
  await login(admin, ACCOUNTS.admin);
  await admin.goto(`/dashboard/orders/${orderId}`);
  await admin.getByRole('button', { name: 'Mulai siapkan order' }).click();
  await admin.getByLabel('Kurir', { exact: true }).fill('JNE');
  await admin.getByLabel('Nomor resi', { exact: true }).fill('JNE0012345678');
  await admin.getByRole('button', { name: 'Tandai sudah dikirim' }).click();
  await expect(admin.getByText('Dalam pengiriman').first()).toBeVisible();

  await customer.reload();
  const tracking = customer.getByRole('region', { name: 'Lacak paket' });
  await expect(tracking).toBeVisible();
  await expect(tracking.getByText('JNE0012345678')).toBeVisible();
  await expect(tracking.getByText('Paket diserahkan Langkah Kaki ke kurir JNE').first()).toBeVisible();

  // Salin resi (CopyButton Arc).
  await tracking.getByRole('button', { name: 'Salin resi' }).click();
  await expect(tracking.getByRole('status').filter({ hasText: 'Salin resi: tersalin' })).toBeAttached();
  expect(await customer.evaluate(() => navigator.clipboard.readText())).toBe('JNE0012345678');

  // Kabar perjalanan bertambah sendiri tanpa memuat ulang, sampai paket diterima.
  await expect(tracking.getByText('Paket diproses di gudang sortir').first()).toBeVisible({ timeout: 40_000 });
  await expect(tracking.getByText(/^Paket diterima oleh /).first()).toBeVisible({ timeout: 70_000 });

  // Selama masih dikirim, retur belum bisa diajukan.
  await expect(customer.getByText('Ajukan pengembalian barang')).toHaveCount(0);

  // Konfirmasi memakai Dialog Arc. Batal dulu: pesanan tidak berubah.
  await customer.getByRole('button', { name: 'Pesanan sudah saya terima' }).click();
  const dialog = customer.getByRole('dialog', { name: 'Pesanan sudah kamu terima?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Batal' }).click();
  await expect(dialog).toBeHidden();
  await expect(customer.getByText('Dalam pengiriman').first()).toBeVisible();

  await customer.getByRole('button', { name: 'Pesanan sudah saya terima' }).click();
  await dialog.getByRole('button', { name: 'Ya, sudah diterima' }).click();
  await expect(customer.getByText('Pesanan sudah diterima.')).toBeVisible();
  await expect(customer.getByText('Ajukan pengembalian barang').first()).toBeVisible();
  // Riwayat perjalanan tetap bisa dilihat setelah pesanan selesai.
  await expect(customer.getByRole('region', { name: 'Lacak paket' })).toBeVisible();
});
