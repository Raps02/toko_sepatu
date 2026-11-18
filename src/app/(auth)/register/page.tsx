import type { Metadata } from 'next';
import Link from 'next/link';
import { registerAction } from '@/actions/auth.actions';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { GoogleSignInButton, OrDivider } from '@/components/ui/GoogleSignInButton';
import { googleLoginEnabled } from '@/lib/google-auth';

export const metadata: Metadata = { title: 'Daftar' };

export default function RegisterPage() {
  const google = googleLoginEnabled();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Buat Akun Pembeli</h1>
      <p className="mt-1 text-sm text-ink-muted">Daftar untuk checkout lebih cepat dan simpan alamat pengiriman.</p>
      {google && (
        <div className="mt-6">
          <GoogleSignInButton label="Daftar dengan Google" />
          <OrDivider />
        </div>
      )}
      <ActionForm action={registerAction} className={google ? 'space-y-4' : 'mt-6 space-y-4'}>
        <TextField label="Nama lengkap" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="username" spellCheck={false} required />
        <TextField
          label="Nomor HP"
          name="phone"
          type="tel"
          autoComplete="tel"
          hint="Opsional. Dipakai kurir kalau perlu menghubungi kamu."
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="Minimal 8 karakter."
        />
        <SubmitButton variant="ink" pendingLabel="Membuat akun…" size="lg" className="w-full">
          Daftar
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-ink-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Masuk
        </Link>
      </p>
    </>
  );
}
