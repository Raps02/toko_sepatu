import type { Metadata } from 'next';
import Link from 'next/link';
import { requestPasswordResetAction } from '@/actions/security.actions';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';

export const metadata: Metadata = { title: 'Lupa kata sandi' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Lupa kata sandi?</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Masukkan email akunmu. Kami kirim link untuk membuat kata sandi baru, berlaku 30 menit.
      </p>
      <ActionForm action={requestPasswordResetAction} className="mt-6 space-y-4">
        <TextField label="Email" name="email" type="email" autoComplete="username" spellCheck={false} enterKeyHint="send" required />
        <SubmitButton variant="ink" pendingLabel="Mengirim…" size="lg" className="w-full">
          Kirim link atur ulang
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-ink-muted">
        Ingat kata sandinya?{' '}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Kembali masuk
        </Link>
      </p>
    </>
  );
}
