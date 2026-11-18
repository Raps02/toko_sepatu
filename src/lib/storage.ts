import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UserFacingError } from '@/lib/action-helpers';

// Penyimpanan gambar. Saat ini ke disk lokal (`public/uploads`), cocok untuk
// development dan server tunggal. Untuk hosting tanpa disk permanen (mis.
// Vercel), ganti isi `saveImage`/`deleteImage` dengan S3 atau Cloudinary;
// pemanggilnya tidak perlu berubah.

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads/';
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Jenis file ditentukan dari isi file, bukan dari nama atau MIME kiriman browser. */
function detectImageExtension(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'webp';
  return null;
}

export async function saveImage(file: File): Promise<string> {
  if (file.size === 0) throw new UserFacingError('Pilih file gambar dulu.');
  if (file.size > MAX_IMAGE_BYTES) throw new UserFacingError('Ukuran gambar maksimal 3 MB.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectImageExtension(bytes);
  if (!extension) throw new UserFacingError('Format gambar harus JPG, PNG, atau WebP.');

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return `${PUBLIC_PREFIX}${filename}`;
}

export async function deleteImage(url: string): Promise<void> {
  if (!url.startsWith(PUBLIC_PREFIX)) return;
  // basename() membuang segmen direktori, jadi URL tidak bisa menunjuk keluar folder unggahan.
  const filename = path.basename(url);
  await unlink(path.join(UPLOAD_DIR, filename)).catch(() => undefined);
}
