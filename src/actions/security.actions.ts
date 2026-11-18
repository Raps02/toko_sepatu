'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signIn } from '@/auth';
import { fail, ok, parseForm } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { appUrl, findUsableToken, issueToken, TOKEN_TTL_MINUTES } from '@/lib/auth-tokens';
import { devPreviewAllowed, emailChangeConfirmEmail, passwordResetEmail, securityNoticeEmail, sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { clientIp, consumeLimit, emailChangeTargetRule, emailChangeUserRule, passwordResetRule } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import {
  changeEmailSchema,
  changePasswordSchema,
  confirmEmailChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations';
import type { ActionResponse } from '@/types';

// Lupa kata sandi, ganti kata sandi, dan ganti email.
// Setiap kata sandi berubah, sessionVersion dinaikkan sehingga sesi di perangkat lain keluar.

// Email ke alamat yang belum tentu milik pemilik akun tidak memuat nama akun:
// nama bisa diisi bebas, jadi jangan sampai email toko dipakai membawa pesan orang lain.
async function notify(email: string, what: string) {
  await sendEmail({ to: { email }, ...securityNoticeEmail({ what }) });
}

// ───────────────────────── Lupa kata sandi (tanpa login) ─────────────────────────

/** Jawabannya selalu sama, terdaftar atau tidak, supaya email pelanggan tidak bisa ditebak dari sini. */
const RESET_SENT = 'Kalau email itu terdaftar, link untuk membuat kata sandi baru sudah kami kirim. Cek kotak masuk dan folder spam.';

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResponse> {
  const { data, invalid } = parseForm(forgotPasswordSchema, formData);
  if (invalid) return invalid;

  // Jawabannya tetap sama supaya batas ini tidak membocorkan apa pun.
  if (!(await consumeLimit(passwordResetRule(clientIp(await headers()))))) return ok(RESET_SENT);

  const user = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, name: true, email: true, isActive: true } });
  if (!user || !user.isActive) return ok(RESET_SENT);

  const token = await issueToken(user.id, 'PASSWORD_RESET');
  // Masih dalam jeda kirim ulang: link sebelumnya masih berlaku.
  if (!token) return ok(RESET_SENT);

  const url = `${appUrl()}/reset-password?token=${token}`;
  const mail = passwordResetEmail({ url, minutes: TOKEN_TTL_MINUTES.PASSWORD_RESET });
  const result = await sendEmail({ to: { email: user.email }, ...mail });
  if (!result.sent && result.reason === 'failed') return fail('Email belum bisa dikirim. Coba lagi beberapa menit lagi.');

  return { success: true, message: RESET_SENT, ...(devPreviewAllowed() ? { devLink: url } : {}) };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResponse> {
  const { data, invalid } = parseForm(resetPasswordSchema, formData);
  if (invalid) return invalid;

  const record = await findUsableToken(data.token, 'PASSWORD_RESET');
  if (!record) return fail('Link ini sudah tidak berlaku. Minta link baru dari halaman lupa kata sandi.');

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    // Link ini dan link lain yang belum terpakai tidak bisa dipakai lagi.
    await tx.authToken.updateMany({ where: { userId: record.userId, type: 'PASSWORD_RESET', usedAt: null }, data: { usedAt: new Date() } });
    await logAudit(tx, { actorId: record.userId, action: 'user.password_reset', entity: 'User', entityId: record.userId });
  });
  await notify(record.user.email, 'kata sandi akunmu baru saja diatur ulang lewat link lupa kata sandi. Semua perangkat lain otomatis keluar.');

  redirect('/login?reset=berhasil');
}

// ───────────────────────── Akun (pembeli yang sedang login) ─────────────────────────

export async function changePasswordAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(changePasswordSchema, formData);
  if (invalid) return invalid;

  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  // Akun dari Google belum punya kata sandi: langsung boleh membuat, karena sudah login.
  if (account.passwordHash) {
    const matches = data.currentPassword ? await bcrypt.compare(data.currentPassword, account.passwordHash) : false;
    if (!matches) {
      return { success: false, message: 'Kata sandi saat ini salah.', error: { currentPassword: ['Kata sandi saat ini salah'] } };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(data.password, 10), sessionVersion: { increment: 1 } },
    });
    await logAudit(tx, { actorId: user.id, action: account.passwordHash ? 'user.password_change' : 'user.password_create', entity: 'User', entityId: user.id });
  });
  await notify(user.email, account.passwordHash
    ? 'kata sandi akunmu baru saja diganti dari halaman Akun. Semua perangkat lain otomatis keluar.'
    : 'akunmu sekarang punya kata sandi, jadi bisa masuk dengan email dan kata sandi selain lewat Google.');

  // Sesi lama ikut tidak berlaku, jadi perangkat ini langsung dimasukkan lagi dengan kata sandi baru.
  try {
    await signIn('credentials', { email: user.email, password: data.password, redirectTo: '/account?berhasil=password' });
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  return ok();
}

export async function requestEmailChangeAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(changeEmailSchema, formData);
  if (invalid) return invalid;
  if (data.email === user.email) return { success: false, message: 'Itu email yang sedang kamu pakai.', error: { email: ['Sama dengan email sekarang'] } };

  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (account.passwordHash) {
    const matches = data.emailPassword ? await bcrypt.compare(data.emailPassword, account.passwordHash) : false;
    if (!matches) {
      return { success: false, message: 'Kata sandi saat ini salah.', error: { emailPassword: ['Kata sandi saat ini salah'] } };
    }
  }

  const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (taken) return { success: false, message: 'Email ini sudah dipakai akun lain.', error: { email: ['Sudah dipakai akun lain'] } };

  const allowed = (await consumeLimit(emailChangeUserRule(user.id))) && (await consumeLimit(emailChangeTargetRule(data.email)));
  if (!allowed) return fail('Terlalu banyak permintaan ganti email. Coba lagi nanti.');

  const token = await issueToken(user.id, 'EMAIL_CHANGE', data.email);
  if (!token) return fail('Link konfirmasi baru saja dikirim. Tunggu sebentar sebelum minta lagi.');

  const url = `${appUrl()}/confirm-email?token=${token}`;
  const mail = emailChangeConfirmEmail({ url, minutes: TOKEN_TTL_MINUTES.EMAIL_CHANGE, newEmail: data.email });
  const result = await sendEmail({ to: { email: data.email }, ...mail });
  if (!result.sent && result.reason === 'failed') return fail('Email konfirmasi belum bisa dikirim. Coba lagi beberapa menit lagi.');

  return {
    success: true,
    message: `Link konfirmasi sudah dikirim ke ${data.email}. Email akunmu baru berganti setelah link itu diklik.`,
    ...(devPreviewAllowed() ? { devLink: url } : {}),
  };
}

/** Dari link di email baru. Tidak perlu login: token membuktikan pemilik email baru, dan dibuat oleh pemilik akun. */
export async function confirmEmailChangeAction(formData: FormData): Promise<ActionResponse> {
  const { data, invalid } = parseForm(confirmEmailChangeSchema, formData);
  if (invalid) return invalid;

  const record = await findUsableToken(data.token, 'EMAIL_CHANGE');
  if (!record?.newEmail) return fail('Link ini sudah tidak berlaku. Minta link baru dari halaman Akun.');

  const oldEmail = record.user.email;
  const newEmail = record.newEmail;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { email: newEmail } });
      await tx.authToken.updateMany({ where: { userId: record.userId, type: 'EMAIL_CHANGE', usedAt: null }, data: { usedAt: new Date() } });
      await logAudit(tx, { actorId: record.userId, action: 'user.email_change', entity: 'User', entityId: record.userId, before: { email: oldEmail }, after: { email: newEmail } });
    });
  } catch {
    return fail('Email ini sudah dipakai akun lain.');
  }
  await notify(oldEmail, `email akunmu sudah diganti dari ${oldEmail} ke ${newEmail}. Mulai sekarang masuk memakai email baru.`);

  revalidatePath('/', 'layout');
  // Token sudah terpakai, jadi halaman konfirmasi dialihkan ke tampilan "berhasil".
  redirect('/confirm-email?berhasil=1');
}
