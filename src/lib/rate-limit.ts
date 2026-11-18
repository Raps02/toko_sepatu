import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Pembatas percobaan yang disimpan di database, jadi tetap berlaku setelah server
// dinyalakan ulang dan kalau server lebih dari satu. Email dan IP disimpan sebagai hash.

export type LimitRule = { key: string; max: number; windowSeconds: number };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function limitKey(bucket: string, value: string): string {
  return `${bucket}:${createHash('sha256').update(value.trim().toLowerCase()).digest('hex')}`;
}

/** IP pengunjung. Entri terakhir adalah yang dicatat server atau proxy terdekat. */
export function clientIp(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? headers.get('x-real-ip')?.trim() ?? 'unknown';
}

/**
 * Batas gagal login. Pasangan email + IP paling ketat; batas per email menahan penyerang
 * yang berganti IP, dan batasnya longgar supaya orang lain sulit mengunci pemilik akun.
 */
export function loginRules(email: string, ip: string): [LimitRule, LimitRule, LimitRule] {
  return [
    { key: limitKey('login-pair', `${email}|${ip}`), max: 8, windowSeconds: 15 * MINUTE },
    { key: limitKey('login-email', email), max: 30, windowSeconds: HOUR },
    { key: limitKey('login-ip', ip), max: 60, windowSeconds: 15 * MINUTE },
  ];
}

export const registerRule = (ip: string): LimitRule => ({ key: limitKey('register', ip), max: 10, windowSeconds: HOUR });
export const passwordResetRule = (ip: string): LimitRule => ({ key: limitKey('reset', ip), max: 10, windowSeconds: HOUR });
export const emailChangeUserRule = (userId: string): LimitRule => ({ key: limitKey('email-user', userId), max: 5, windowSeconds: HOUR });
export const emailChangeTargetRule = (email: string): LimitRule => ({ key: limitKey('email-target', email), max: 3, windowSeconds: DAY });
export const checkoutRule = (ip: string): LimitRule => ({ key: limitKey('checkout', ip), max: 15, windowSeconds: HOUR });

/** Menambah hitungan. `false` berarti batasnya sudah terlampaui. */
export async function consumeLimit(rule: LimitRule): Promise<boolean> {
  const now = Date.now();
  const resetAt = now + rule.windowSeconds * 1000;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits ("key", "count", "resetAt")
    VALUES (${rule.key}, 1, ${resetAt}::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limits."resetAt" <= ${now}::bigint THEN 1 ELSE rate_limits."count" + 1 END,
      "resetAt" = CASE WHEN rate_limits."resetAt" <= ${now}::bigint THEN EXCLUDED."resetAt" ELSE rate_limits."resetAt" END
    RETURNING "count"
  `;
  // Sesekali membersihkan baris yang sudah lewat, supaya tabelnya tidak terus tumbuh.
  if (Math.random() < 0.01) await prisma.$executeRaw`DELETE FROM rate_limits WHERE "resetAt" < ${now}::bigint`;
  return Number(rows[0]?.count ?? 0) <= rule.max;
}

/** Apakah salah satu batas sudah penuh? Tidak menambah hitungan. */
export async function isLimited(rules: LimitRule[]): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ key: string; count: number; resetAt: bigint }[]>`
    SELECT "key", "count", "resetAt" FROM rate_limits WHERE "key" IN (${Prisma.join(rules.map((rule) => rule.key))})
  `;
  const now = Date.now();
  return rows.some((row) => {
    const rule = rules.find((candidate) => candidate.key === row.key);
    return Boolean(rule && Number(row.resetAt) > now && Number(row.count) >= rule.max);
  });
}

export async function clearLimit(rule: LimitRule): Promise<void> {
  await prisma.$executeRaw`DELETE FROM rate_limits WHERE "key" = ${rule.key}`;
}
