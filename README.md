# Tapak: Toko Sepatu Online

Toko sepatu online dengan tiga role (Admin, Supervisor, Customer), dibangun dengan **Next.js App Router**, **TypeScript**, **PostgreSQL**, **Prisma**, **Auth.js**, **Zod**, dan **Tailwind CSS**. Pembayaran lewat **Midtrans Snap**.

Nama toko "Tapak" hanya nama kerja. Ganti di `src/lib/site.ts`.

## Menjalankan proyek

1. **Install dependensi**
   ```bash
   npm install
   ```

2. **Siapkan environment**
   ```bash
   cp .env.example .env
   ```
   Isi `AUTH_SECRET` dengan hasil `openssl rand -base64 33`. `MIDTRANS_SERVER_KEY` boleh dikosongkan dulu (lihat bagian Pembayaran).

3. **Nyalakan PostgreSQL**
   ```bash
   docker compose up -d
   ```
   Database proyek ini memakai port host **5433**, supaya tidak bentrok dengan PostgreSQL lain di 5432.

4. **Buat tabel dan data contoh**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Jalankan server development**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000`.

## Akun contoh

Dibuat oleh `npm run db:seed`. Password semuanya `password123`; ganti sebelum dipakai sungguhan.

| Role | Email |
|---|---|
| Admin | `admin@tapak.test` |
| Supervisor | `spv@tapak.test` |
| Customer | `customer@tapak.test` |

## Hak akses

Seluruh aturan ada di satu file, `src/lib/permissions.ts`, dan dipakai oleh middleware, menu dashboard, halaman, dan setiap server action.

| Fitur | Admin | Supervisor | Customer |
|---|---|---|---|
| Kelola akun | Ya | - | Profil sendiri |
| Laporan keuangan | Rentang tanggal + ekspor | Harian, lihat saja | - |
| Produk, varian, foto | Ya | Ya | Lihat |
| Harga dan diskon | Langsung berlaku | Mengajukan, admin menyetujui | - |
| Barang masuk dan keluar | Ya | Ya | - |
| Koreksi stok dan data kirim | Langsung berlaku | Mengajukan, admin menyetujui | - |
| Proses order | Ya | Ya | Order sendiri |
| Retur | Setujui, terima, refund | Setujui, terima | Mengajukan |
| Review | Balas, sembunyikan, laporan rating | Balas | Tulis (barang yang sudah diterima) |
| Chat produk | Balas | Balas | Mulai chat |
| Ongkir, riwayat perubahan | Ya | - | - |

## Pembayaran (Midtrans)

1. Buat akun di dashboard Midtrans dan ambil **Server Key** sandbox (Settings > Access Keys), lalu isi `MIDTRANS_SERVER_KEY` di `.env`.
2. Daftarkan Payment Notification URL (Settings > Configuration):
   `https://<domain-kamu>/api/webhooks/midtrans`
   Saat development, pakai tunnel (misalnya `cloudflared` atau `ngrok`) supaya Midtrans bisa menjangkau `localhost`.
3. Isi `APP_URL` dengan alamat publik website. Pembeli diarahkan kembali ke sana setelah membayar.

Selama `MIDTRANS_SERVER_KEY` kosong, pembayaran online mati. Di mode development, halaman pesanan menampilkan tombol **Tandai dibayar (uji coba)** supaya alur order tetap bisa dicoba. Tombol itu tidak ada di production.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server development |
| `npm run build` | Generate Prisma Client dan build produksi |
| `npm run lint` | ESLint |
| `npm run test` | Unit test (harga, hak akses, signature Midtrans) |
| `npm run db:migrate` | Menjalankan migrasi Prisma |
| `npm run db:seed` | Mengisi akun, produk, dan ongkir contoh |
| `npm run db:studio` | Prisma Studio |

## Yang perlu diketahui

- **Foto produk** disimpan di `public/uploads`. Ini cocok untuk development dan server tunggal. Untuk hosting tanpa disk permanen (misalnya Vercel), ganti isi `src/lib/storage.ts` dengan S3 atau Cloudinary.
- **Refund** dicatat manual. Admin mengembalikan dana lewat dashboard Midtrans atau transfer, lalu menandainya di dashboard toko.
- **Ongkir** flat per provinsi dan diatur admin. Nomor resi diisi manual saat order dikirim.
- **Chat** memuat ulang tiap beberapa detik (polling), bukan WebSocket.
- **Order yang tidak dibayar** kedaluwarsa setelah 6 jam dan stoknya kembali otomatis, lewat notifikasi Midtrans dan pengecekan saat daftar order dibuka.
- **Zona waktu** laporan dan tanggal adalah WIB (`src/lib/format.ts`).
- **Invoice** bisa diunduh pembeli sebagai PDF dari halaman pesanan setelah pembayaran diterima. Logonya digambar dari `src/lib/brand.ts`; alamat dan kontak toko yang dicetak diisi di `STORE_CONTACT` pada `src/lib/site.ts`.
