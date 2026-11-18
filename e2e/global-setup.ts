import { execSync } from 'node:child_process';

// Mengosongkan lalu mengisi ulang database test sebelum setiap run, supaya hasil test
// tidak bergantung pada stok atau pesanan dari run sebelumnya.
// Halaman yang dikompilasi duluan. Server dev mengompilasi tiap halaman saat pertama
// dibuka; tanpa pemanasan, test pertama bisa melewati batas waktu 30 detik.
const WARM_UP_PATHS = ['/', '/login', '/products', '/products/kota-low', '/cart', '/checkout', '/orders', '/dashboard', '/dashboard/chat'];

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';

  // Pengaman: `--force-reset` menghapus semua data. Hanya boleh jalan di database test.
  if (!/\/toko_sepatu_e2e(\?|$)/.test(url)) {
    throw new Error('DATABASE_URL bukan database toko_sepatu_e2e. Reset dibatalkan demi keamanan data.');
  }

  execSync('npx prisma db push --force-reset --skip-generate', { stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

  // webServer sudah menyala sebelum globalSetup berjalan.
  const baseURL = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
  for (const path of WARM_UP_PATHS) {
    await fetch(`${baseURL}${path}`, { redirect: 'manual' }).catch(() => undefined);
  }
}
