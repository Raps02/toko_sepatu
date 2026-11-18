import { defineConfig, devices } from '@playwright/test';

// Semua env (termasuk DATABASE_URL ke database khusus test) diambil dari .env.e2e.
process.loadEnvFile('.env.e2e');

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Test checkout mengubah stok dan membuat pesanan di DB yang sama, jadi berjalan berurutan.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  // `next dev` mengompilasi tiap halaman saat pertama dibuka, jadi navigasi awal bisa lambat.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    // Cek siap lewat healthcheck (cuma SELECT 1), bukan beranda: server menyala sebelum
    // globalSetup mem-push schema, jadi beranda bisa error kalau schema baru berubah.
    url: `${BASE_URL}/api/health`,
    // Jangan pernah memakai ulang server lain: harus server yang menunjuk ke DB test.
    reuseExistingServer: false,
    timeout: 120_000,
    // Next juga membaca .env milik development. Layanan luar dikosongkan paksa di sini
    // (env proses menang atas .env), supaya E2E tidak mengirim email sungguhan lewat Brevo
    // atau menampilkan tombol Google walaupun kuncinya sudah diisi di .env.
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      BREVO_API_KEY: '',
      EMAIL_FROM: '',
      AUTH_GOOGLE_ID: '',
      AUTH_GOOGLE_SECRET: '',
      MIDTRANS_SERVER_KEY: '',
      OPENAI_API_KEY: '',
      TRACKING_SIM_PACE: 'demo',
    },
  },
});
