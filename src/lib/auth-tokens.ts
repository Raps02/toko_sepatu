import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Token sekali pakai untuk link di email (reset kata sandi, konfirmasi email baru).
// Database hanya menyimpan hash-nya, jadi kebocoran database tidak membocorkan link aktif.

export const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  PASSWORD_RESET: 30,
  EMAIL_CHANGE: 60,
};

/** Jeda minimal antar permintaan email untuk akun yang sama, supaya tidak dipakai menyepam. */
export const RESEND_COOLDOWN_SECONDS = 60;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

type TokenRecord = { expiresAt: Date; usedAt: Date | null };

export function tokenUsable(record: TokenRecord | null, now: Date = new Date()): boolean {
  return Boolean(record && !record.usedAt && record.expiresAt.getTime() > now.getTime());
}

/** Masih dalam jeda kirim ulang? */
export function inCooldown(lastCreatedAt: Date | null | undefined, now: Date = new Date()): boolean {
  return Boolean(lastCreatedAt && now.getTime() - lastCreatedAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000);
}

/**
 * Buat token baru untuk user. Token lama yang belum terpakai (jenis yang sama) dibatalkan,
 * jadi hanya link terakhir yang berlaku. Mengembalikan null kalau masih dalam jeda kirim ulang.
 */
export async function issueToken(userId: string, type: AuthTokenType, newEmail?: string): Promise<string | null> {
  const last = await prisma.authToken.findFirst({ where: { userId, type }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  if (inCooldown(last?.createdAt)) return null;

  const { token, tokenHash } = generateToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash, newEmail: newEmail ?? null, expiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES[type] * 60_000) },
    }),
  ]);
  return token;
}

/** Token yang masih berlaku beserta pemiliknya, atau null. */
export async function findUsableToken(token: string, type: AuthTokenType) {
  if (!token || token.length > 200) return null;
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, isActive: true, passwordHash: true } } },
  });
  if (!record || record.type !== type || !tokenUsable(record) || !record.user.isActive) return null;
  return record;
}

/** Alamat dasar untuk link di email. Diambil dari APP_URL, bukan dari header request. */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}
