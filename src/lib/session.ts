import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { can, homePathFor, type Permission, type Role } from '@/lib/permissions';
import type { ActionResponse } from '@/types';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type SessionState = {
  user: SessionUser | null;
  /** Ada cookie sesi, tapi sudah tidak berlaku (akun nonaktif, dihapus, atau kata sandi diganti). */
  stale: boolean;
};

/**
 * Sesi yang sedang aktif, dengan user dibaca ulang dari database pada tiap request.
 * Dengan begitu akun yang dinonaktifkan atau role yang diubah admin langsung
 * berlaku, tidak menunggu token JWT kedaluwarsa. Sesi dari sebelum kata sandi
 * diganti/di-reset (sessionVersion lama) juga dianggap sudah keluar.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { user: null, stale: false };

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true, sessionVersion: true },
  });
  if (!user || !user.isActive || (session.user.sessionVersion ?? 0) !== user.sessionVersion) {
    return { user: null, stale: true };
  }
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, stale: false };
});

/** User yang sedang login, atau null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => (await getSessionState()).user);

/** Ke sini kalau sesinya basi: cookie dihapus dulu, lalu ke halaman login (src/app/api/auth/session-expired). */
export const SESSION_EXPIRED_PATH = '/api/auth/session-expired';

// ── Untuk halaman (Server Components): mengalihkan kalau tidak berhak ──

export async function requireUser(): Promise<SessionUser> {
  const { user, stale } = await getSessionState();
  // Cookie sesi basi harus dihapus dulu; kalau tidak, middleware menganggapnya masih login
  // dan mengalihkan /login kembali ke beranda.
  if (!user) redirect(stale ? SESSION_EXPIRED_PATH : '/login');
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect(homePathFor(user.role));
  return user;
}

// ── Untuk server action: mengembalikan ActionResponse kalau tidak berhak ──

type Granted = { user: SessionUser; denied: null };
type Denied = { user: null; denied: ActionResponse };

/**
 * Wajib dipanggil di baris pertama setiap server action:
 *
 *   const { user, denied } = await requirePermission('product.manage');
 *   if (denied) return denied;
 */
export async function requirePermission(permission: Permission): Promise<Granted | Denied> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, denied: { success: false, message: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.' } };
  }
  if (!can(user.role, permission)) {
    return { user: null, denied: { success: false, message: 'Akun kamu tidak punya izin untuk tindakan ini.' } };
  }
  return { user, denied: null };
}

/** Seperti `requirePermission`, tapi lolos kalau punya salah satu dari beberapa izin. */
export async function requireAnyPermission(permissions: Permission[]): Promise<Granted | Denied> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, denied: { success: false, message: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.' } };
  }
  if (!permissions.some((p) => can(user.role, p))) {
    return { user: null, denied: { success: false, message: 'Akun kamu tidak punya izin untuk tindakan ini.' } };
  }
  return { user, denied: null };
}
