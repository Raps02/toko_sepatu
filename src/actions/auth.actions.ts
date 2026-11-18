'use server';

import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { AuthError, CredentialsSignin } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { loginSchema, registerSchema } from '@/lib/validations';
import { fail, failFrom, isUniqueViolation, parseForm } from '@/lib/action-helpers';
import { googleLoginEnabled } from '@/lib/google-auth';
import { homePathFor } from '@/lib/permissions';
import { clientIp, consumeLimit, registerRule } from '@/lib/rate-limit';
import type { ActionResponse } from '@/types';

// `signIn` menyelesaikan login dengan melempar redirect, jadi error selain
// AuthError harus dilempar ulang supaya pengalihannya tetap berjalan.
async function signInAndRedirect(email: string, password: string): Promise<ActionResponse> {
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true, passwordHash: true, googleId: true } });
  if (user && !user.passwordHash && user.googleId) {
    return fail('Akun ini terdaftar lewat Google. Pakai tombol "Masuk dengan Google".');
  }
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: user ? homePathFor(user.role) : '/',
    });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === 'rate_limited') {
      return fail('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit, atau atur ulang kata sandi.');
    }
    if (error instanceof AuthError) return fail('Email atau password salah.');
    throw error;
  }
  return { success: true };
}

export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const { data, invalid } = parseForm(loginSchema, formData);
  if (invalid) return invalid;

  return signInAndRedirect(data.email, data.password);
}

/** Pendaftaran publik selalu menghasilkan akun CUSTOMER; akun staf dibuat admin. */
export async function registerAction(formData: FormData): Promise<ActionResponse> {
  const { data, invalid } = parseForm(registerSchema, formData);
  if (invalid) return invalid;

  if (!(await consumeLimit(registerRule(clientIp(await headers()))))) {
    return fail('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.');
  }

  try {
    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: 'CUSTOMER',
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        message: 'Email ini sudah terdaftar. Masuk dengan email tersebut atau pakai email lain.',
        error: { email: ['Email sudah terdaftar'] },
      };
    }
    return failFrom(error, 'Akun belum bisa dibuat. Coba lagi sebentar lagi.');
  }

  return signInAndRedirect(data.email, data.password);
}

/** Masuk atau daftar dengan Google (khusus pembeli). Pengecekan akunnya ada di callback signIn di src/auth.ts. */
export async function googleSignInAction(): Promise<void> {
  if (!googleLoginEnabled()) return;
  await signIn('google', { redirectTo: '/' });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
