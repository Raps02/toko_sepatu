import type { Metadata } from 'next';
import Link from 'next/link';
import { loginAction } from '@/actions/auth.actions';
import { Alert } from '@/components/arc/alert/alert';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { GoogleSignInButton, OrDivider } from '@/components/ui/GoogleSignInButton';
import { GOOGLE_ERROR_MESSAGES, googleLoginEnabled, type GoogleRejectReason } from '@/lib/google-auth';

export const metadata: Metadata = { title: 'Masuk' };

type Props = { searchParams: Promise<{ error?: string; reset?: string; sesi?: string }> };

/** Pesan untuk login Google yang ditolak (`google-<alasan>`) atau gagal di tengah jalan (kode error NextAuth). */
function googleErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  const reason = error.replace(/^google-/, '');
  return reason in GOOGLE_ERROR_MESSAGES
    ? GOOGLE_ERROR_MESSAGES[reason as GoogleRejectReason | 'failed']
    : GOOGLE_ERROR_MESSAGES.failed;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const errorMessage = googleErrorMessage(params.error);
  const resetDone = params.reset === 'berhasil';
  const sessionEnded = params.sesi === 'berakhir';
  const google = googleLoginEnabled();

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Masuk ke Akunmu</h1>
      <p className="mt-1 text-sm text-ink-muted">Akses keranjang belanja dan pantau pengiriman sepatumu.</p>
      {resetDone && <Alert tone="success" title="Kata sandi baru sudah disimpan." className="mt-6">Masuk memakai kata sandi baru.</Alert>}
      {sessionEnded && <Alert tone="info" title="Sesimu sudah berakhir." className="mt-6">Misalnya karena kata sandi diganti. Masuk lagi untuk melanjutkan.</Alert>}
      {errorMessage && <Alert tone="danger" title={errorMessage} className="mt-6" />}
      {google && (
        <div className="mt-6">
          <GoogleSignInButton />
          <OrDivider />
        </div>
      )}
      <ActionForm action={loginAction} className={google ? 'space-y-4' : 'mt-6 space-y-4'}>
        <TextField label="Email" name="email" type="email" autoComplete="username" spellCheck={false} required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-ink underline underline-offset-2">
            Lupa kata sandi?
          </Link>
        </p>
        <SubmitButton variant="ink" pendingLabel="Memeriksa…" size="lg" className="w-full">
          Masuk
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-ink-muted">
        Belum punya akun?{' '}
        <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
          Daftar sekarang
        </Link>
      </p>
    </>
  );
}
