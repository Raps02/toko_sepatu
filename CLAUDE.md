# CLAUDE.md - Project Context & Engineering Guidelines

File ini berisi panduan arsitektur, konvensi kode, dan perintah utama untuk membantu **Claude Code** memahami dan memodifikasi codebase ini secara akurat.

## 1. Tech Stack Utama
- **Framework**: Next.js (App Router) dengan TypeScript (`strict: true`)
- **Database**: PostgreSQL
- **ORM**: Prisma ORM (`@prisma/client`)
- **Styling**: Tailwind CSS
- **Icons**: Lucide Icons (`lucide-react`) — *Gunakan selalu `lucide-react`, jangan gunakan feather icons*
- **Validation**: Zod (`src/lib/validations.ts`)

## 2. Perintah Umum (Commands)
- `npm install` : Install seluruh dependensi proyek
- `docker compose up -d` : Menjalankan database PostgreSQL 16 Alpine di background
- `npm run db:migrate` : Menjalankan migrasi Prisma (`npx prisma migrate dev`)
- `npm run db:seed` : Mengisi data awal ke PostgreSQL (`npx prisma db seed`)
- `npm run db:studio` : Membuka GUI Prisma Studio
- `npm run dev` : Menjalankan development server di `http://localhost:3000`
- `npm run build` : Generate Prisma Client dan melakukan build produksi Next.js
- `npm run lint` : Menjalankan pengecekan ESLint
- `npm test` : Unit test (Vitest) untuk fungsi di `src/lib/`
- `npm run test:e2e` : E2E test (Playwright) lewat browser, lihat bagian 4

## 3. Arsitektur & Konvensi Kode
- **Server Components First**: Semua halaman dan komponen di dalam `src/app/` secara default adalah React Server Components (RSC). Hanya tambahkan `'use client'` pada komponen di `src/components/` jika membutuhkan interaksi browser (`useState`, `useEffect`, event handler form).
- **Database Access**: Selalu import singleton `prisma` dari `@/lib/prisma`. Jangan pernah membuat instance `new PrismaClient()` baru di dalam route atau komponen.
- **Data Mutation**: Gunakan **Next.js Server Actions** yang disimpan di dalam `src/actions/` untuk operasi CRUD dari form, diikuti dengan pemanggilan `revalidatePath()`. Gunakan Route Handlers (`src/app/api/`) hanya untuk webhook eksternal, healthcheck, atau integrasi pihak ketiga.
- **Komponen Arc** (`src/components/arc/`, dari uiarc.dev): button, input, textarea, select, combobox, radio-cards, carousel, stepper, breadcrumb, search-field, date-picker, calendar, checkbox, file-dropzone, password-field, number-field, rating, card, drawer, badge, avatar, alert, accordion, pagination, segmented-control, sortable-data-table, empty-state, metric-card, line-chart, donut-chart, dialog, timeline, copy-button, text-morph. `ActionForm` dengan `confirmMessage` memakai Dialog Arc (bukan `window.confirm`). Token warnanya ditimpa palet toko di `src/components/arc/theme.css`, jadi jangan pakai warna netral bawaan Arc. Pakai lewat pembungkus toko (`ui/Button`, `ui/ButtonLink` (tautan bergaya tombol), `ui/Field`, `ui/QuantityStepper`, `shop/Stars`, `Badge` dan `EmptyState` di `dashboard/PageHeader`, serta `dashboard/Panel`, `DataTable`, `LinkSegments`, `UrlPagination`, `Disclosure`), bukan langsung, supaya varian dan teks Indonesia tetap konsisten. Select Arc adalah combobox Radix: di E2E pakai `getByRole('combobox')` lalu `getByRole('option')`, bukan `selectOption`.
- **Input Validation**: Semua input dari `FormData` atau request body wajib divalidasi terlebih dahulu menggunakan skema **Zod** di `src/lib/validations.ts` sebelum menyentuh query Prisma.

## 4. Testing
- **Vitest** (`npm test`): untuk logika murni (harga, izin, invoice, Midtrans). Cepat, jalankan saat mengerjakan fungsi di `src/lib/`. File test berpola `src/**/*.test.ts`.
- **Playwright E2E** (`npm run test:e2e`): untuk alur lengkap lewat browser. Lambat (sekitar 5 menit) dan berat, jadi **hanya dijalankan untuk perubahan besar**. Skill `e2e-testing` tersedia untuk pola penulisan test.
- **Kapan menjalankan test**:
  - **Perubahan kecil: jangan jalankan E2E sama sekali, termasuk satu spec.** Contohnya tampilan, teks, perbaikan bug di satu fungsi atau satu halaman, dan penyesuaian validasi. Cukup `npx tsc --noEmit`, `npm run lint`, dan `npm test`.
  - **Perubahan besar: jalankan E2E sekali setelah semuanya selesai.** Contohnya fitur baru, perubahan alur checkout, pembayaran, login, atau hak akses, migrasi database, dan refactor lintas banyak halaman. Kalau ada yang gagal, perbaiki lalu ulangi spec yang gagal saja, bukan seluruh suite.
  - Di luar itu, E2E dijalankan kalau diminta atau sebelum deploy.
- **Cakupan E2E saat ini** (folder `e2e/`): login/daftar, katalog → keranjang → checkout → bayar (mode uji coba) → lihat invoice, kirim oleh staf → lacak paket (simulasi) → konfirmasi diterima, filter Pria/Wanita + panduan ukuran, chat melayang (pembeli → butuh staf → balasan staf), dan hak akses customer vs admin. Bot OpenAI sengaja mati di E2E (`OPENAI_API_KEY=""` di `.env.e2e`, logikanya dites di `src/lib/chatbot.test.ts` dengan fetch tiruan). Dashboard staf lainnya, retur, dan Midtrans sungguhan **belum** dites. Saat menambah atau mengubah alur penting, tambahkan test E2E-nya dan jalankan saat perubahan besar itu selesai.
- **Database test terpisah**: E2E memakai database `toko_sepatu_e2e` (config di `.env.e2e`, tidak di-commit), bukan `app_db`. `e2e/global-setup.ts` mereset dan men-seed ulang database itu sebelum tiap run dan menolak jalan kalau `DATABASE_URL` bukan `toko_sepatu_e2e`. Jangan pernah mengarahkan E2E ke `app_db`.
- **Server test**: berjalan di port **3100** dengan `NEXT_DIST_DIR=.next-e2e`, supaya tidak bentrok dengan `npm run dev` di port 3000. Di config `reuseExistingServer: false`.
- **Selector**: komponen belum memakai `data-testid`. Gunakan `getByRole`/`getByLabel`/`getByText` sesuai teks UI (bahasa Indonesia).
- **Data seed yang dipakai test**: akun `customer@tapak.test` dan `admin@tapak.test` (password `password123`), produk "Kota Low", dan alamat default customer di DKI Jakarta. Kalau `prisma/seed.ts` berubah, sesuaikan test.
- **Akun & kata sandi**: lupa kata sandi (`/forgot-password` → `/reset-password?token=`), ganti kata sandi/email di `/account`, konfirmasi email baru di `/confirm-email`. Token di tabel `auth_tokens` (hanya hash). Email lewat Brevo (`src/lib/email.ts`); tanpa `BREVO_API_KEY` di development, link tampil di halaman (`devLink`). Ganti/reset kata sandi menaikkan `User.sessionVersion` sehingga sesi lain keluar (`getSessionState` di `src/lib/session.ts`).
- **Invoice lewat email**: saat pesanan baru dibayar (Midtrans atau uji coba), `sendInvoiceEmail()` (`src/lib/invoice-email.ts`) mengirim PDF invoice sebagai lampiran lewat `after()`. `Order.invoiceEmailedAt` mencegah kiriman dobel; pembeli bisa kirim ulang dari halaman pesanan (jeda 60 detik).
- **E2E dan layanan luar**: `playwright.config.ts` mengosongkan paksa kunci Brevo, Google, Midtrans, dan OpenAI untuk server test, karena Next juga membaca `.env` development.
- **Login Google** (khusus pembeli): `src/lib/google-auth.ts` (cek ID Google → sambung lewat email terverifikasi → buat akun CUSTOMER; staf ditolak). Tombol hanya tampil kalau `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` terisi; di E2E sengaja kosong. Akun buatan Google tidak punya password (`passwordHash` null).
- **Pembatas percobaan** (`src/lib/rate-limit.ts`, tabel `rate_limits`): gagal login, daftar, lupa kata sandi, ganti email, dan checkout. Order belum dibayar dibatasi per akun (`src/lib/order-limits.ts`) dan kedaluwarsa setelah `PAYMENT_WINDOW_HOURS`.
- **Lacak paket**: masih SIMULASI (`src/lib/tracking.ts`), kabar perjalanan dibuat dari waktu kirim, kurir, dan kota tujuan. `TRACKING_SIM_PACE="demo"` (default) memunculkan kabar tiap 5-10 detik; `"realtime"` mengikuti jam perjalanan. Untuk layanan sungguhan, ganti isi `trackShipment()`.
- **Pembayaran**: `MIDTRANS_SERVER_KEY` sengaja dikosongkan di `.env.e2e` supaya tombol "Tandai dibayar (uji coba)" muncul.
