import type { Role } from '@prisma/client';
import { logAudit } from '@/lib/audit';
import { securityNoticeEmail, sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';

// Login dengan Google untuk PEMBELI.
//
// Urutan pengecekan saat Google mengembalikan akun:
// 1. ID Google (sub) sudah tersimpan di user  -> masuk ke akun itu.
// 2. Belum, tapi emailnya sudah terdaftar     -> ID Google disambungkan ke akun itu, lalu masuk.
// 3. Belum ada sama sekali                    -> akun CUSTOMER dibuat otomatis, lalu masuk.
//
// Ditolak bila: email belum diverifikasi Google, akun dinonaktifkan, atau akunnya
// milik staf (admin/SPV wajib masuk lewat email dan password).

/** Tombol Google hanya tampil kalau kunci OAuth sudah diisi di .env. */
export function googleLoginEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export type GoogleProfileInput = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

type ExistingUser = { id: string; role: Role; isActive: boolean; googleId: string | null };

export type GoogleRejectReason = 'unverified' | 'inactive' | 'staff' | 'linked-elsewhere';

export type GoogleDecision =
  | { action: 'login'; userId: string }
  | { action: 'link'; userId: string }
  | { action: 'create' }
  | { action: 'reject'; reason: GoogleRejectReason };

/** Keputusan murni (tanpa database), supaya mudah dites. */
export function decideGoogleSignIn(
  profile: GoogleProfileInput,
  byGoogleId: ExistingUser | null,
  byEmail: ExistingUser | null,
): GoogleDecision {
  const existing = byGoogleId ?? byEmail;
  if (existing) {
    if (existing.role !== 'CUSTOMER') return { action: 'reject', reason: 'staff' };
    if (!existing.isActive) return { action: 'reject', reason: 'inactive' };
  }
  if (byGoogleId) return { action: 'login', userId: byGoogleId.id };

  // Menyambung ke akun lama atau membuat akun baru hanya kalau Google sudah memverifikasi
  // emailnya. Tanpa ini, siapa pun bisa mengambil alih akun lewat email yang sama.
  if (!profile.emailVerified) return { action: 'reject', reason: 'unverified' };

  if (byEmail) {
    // Email ini sudah tersambung ke akun Google lain (mis. email Google-nya pernah diganti).
    if (byEmail.googleId && byEmail.googleId !== profile.sub) return { action: 'reject', reason: 'linked-elsewhere' };
    return { action: 'link', userId: byEmail.id };
  }
  return { action: 'create' };
}

/**
 * Perubahan akun saat disambungkan ke Google. Pendaftaran biasa tidak memverifikasi email,
 * jadi password yang sudah ada bisa saja dibuat orang lain sebelum pemilik email datang.
 * Google baru saja membuktikan pemiliknya, maka password lama dan sesi lamanya dicabut.
 */
export function googleLinkData(sub: string, hasPassword: boolean) {
  return {
    googleId: sub,
    ...(hasPassword && { passwordHash: null, sessionVersion: { increment: 1 } }),
  };
}

/** Pesan untuk halaman login, dari `?error=` yang dikirim saat login Google ditolak. */
export const GOOGLE_ERROR_MESSAGES: Record<GoogleRejectReason | 'failed', string> = {
  unverified: 'Email akun Google kamu belum terverifikasi. Verifikasi dulu di Google, lalu coba lagi.',
  inactive: 'Akun ini sedang dinonaktifkan. Hubungi toko untuk bantuan.',
  staff: 'Akun staf masuk lewat email dan password, bukan Google.',
  'linked-elsewhere': 'Email ini sudah tersambung ke akun Google lain. Masuk dengan akun Google tersebut atau pakai password.',
  failed: 'Masuk dengan Google gagal. Coba lagi sebentar lagi.',
};

export type GoogleSignInResult =
  | { ok: true; user: { id: string; name: string; email: string; role: Role } }
  | { ok: false; reason: GoogleRejectReason };

/** Cek, sambungkan, atau buat akun pembeli untuk profil Google ini. */
export async function signInWithGoogleProfile(profile: GoogleProfileInput): Promise<GoogleSignInResult> {
  const email = profile.email.trim().toLowerCase();
  const select = { id: true, name: true, email: true, role: true, isActive: true, googleId: true } as const;
  const [byGoogleId, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { googleId: profile.sub }, select }),
    prisma.user.findUnique({ where: { email }, select }),
  ]);

  const decision = decideGoogleSignIn({ ...profile, email }, byGoogleId, byEmail);
  const pick = ({ id, name, email, role }: { id: string; name: string; email: string; role: Role }) => ({ id, name, email, role });

  switch (decision.action) {
    case 'reject':
      return { ok: false, reason: decision.reason };
    case 'login':
      return { ok: true, user: pick(byGoogleId!) };
    case 'link': {
      const current = await prisma.user.findUniqueOrThrow({ where: { id: decision.userId }, select: { passwordHash: true } });
      const hadPassword = Boolean(current.passwordHash);
      const user = await prisma.$transaction(async (tx) => {
        const linked = await tx.user.update({ where: { id: decision.userId }, data: googleLinkData(profile.sub, hadPassword), select });
        // Link reset atau ganti email yang masih terbuka ikut dibatalkan.
        await tx.authToken.updateMany({ where: { userId: linked.id, usedAt: null }, data: { usedAt: new Date() } });
        await logAudit(tx, { actorId: linked.id, action: 'user.google_link', entity: 'User', entityId: linked.id, after: { email } });
        return linked;
      });
      if (hadPassword) {
        const what = 'akunmu sekarang tersambung ke Google. Kata sandi lama dinonaktifkan dan semua perangkat lain keluar. Kamu bisa membuat kata sandi baru dari halaman Akun.';
        await sendEmail({ to: { email }, ...securityNoticeEmail({ what }) });
      }
      return { ok: true, user: pick(user) };
    }
    case 'create': {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name: profile.name.trim() || email.split('@')[0]!, email, googleId: profile.sub, role: 'CUSTOMER' },
          select,
        });
        await logAudit(tx, { actorId: created.id, action: 'user.google_signup', entity: 'User', entityId: created.id, after: { email } });
        return created;
      });
      return { ok: true, user: pick(user) };
    }
  }
}
