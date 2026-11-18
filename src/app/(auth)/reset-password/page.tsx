import type { Metadata } from 'next';
import Link from 'next/link';
import { resetPasswordAction } from '@/actions/security.actions';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { findUsableToken } from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buat kata sandi baru', referrer: 'no-referrer' };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const token = (await searchParams).token ?? '';
  const record = await findUsableToken(token, 'PASSWORD_RESET');

  if (!record) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Link tidak berlaku</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Link atur ulang kata sandi ini sudah kedaluwarsa atau sudah dipakai. Minta link baru, lalu buka link terbaru di emailmu.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-ink-soft"
        >
          Minta link baru
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Buat kata sandi baru</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Untuk akun <span className="font-semibold text-ink">{record.user.email}</span>. Setelah disimpan, semua perangkat lain otomatis keluar.
      </p>
      <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        {/* Untuk pengelola kata sandi browser: kata sandi baru disimpan untuk email ini. */}
        <input type="email" name="username" autoComplete="username" value={record.user.email} readOnly hidden />
        <TextField
          label="Kata sandi baru"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          hint="Minimal 8 karakter. Ketuk ikon mata untuk melihat yang kamu ketik."
        />
        <SubmitButton variant="ink" pendingLabel="Menyimpan…" size="lg" className="w-full">
          Simpan kata sandi baru
        </SubmitButton>
      </ActionForm>
    </>
  );
}
