import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmailChangeAction } from '@/actions/security.actions';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { findUsableToken } from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Konfirmasi email baru', referrer: 'no-referrer' };

type Props = { searchParams: Promise<{ token?: string; berhasil?: string }> };

/** Email baru dikonfirmasi lewat tombol, bukan saat halaman dibuka, supaya pemindai link di kotak masuk tidak ikut mengonfirmasi. */
export default async function ConfirmEmailPage({ searchParams }: Props) {
  const params = await searchParams;
  if (params.berhasil === '1') {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Email berhasil diganti</h1>
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Email akunmu sudah diperbarui. Mulai sekarang masuk memakai email baru. Kami juga mengirim pemberitahuan ke email lama.
        </p>
        <Link href="/account" className="mt-6 inline-block text-sm font-semibold text-ink underline underline-offset-2">
          Ke halaman Akun
        </Link>
      </>
    );
  }

  const token = params.token ?? '';
  const record = await findUsableToken(token, 'EMAIL_CHANGE');

  if (!record?.newEmail) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Link tidak berlaku</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Link konfirmasi ini sudah kedaluwarsa atau sudah dipakai. Ganti email lagi dari halaman Akun untuk mendapat link baru.
        </p>
        <Link href="/account" className="mt-6 inline-block text-sm font-semibold text-ink underline underline-offset-2">
          Ke halaman Akun
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Konfirmasi email baru</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Email akun <span className="font-semibold text-ink">{record.user.email}</span> akan diganti menjadi{' '}
        <span className="font-semibold text-ink">{record.newEmail}</span>. Setelah itu, masuk memakai email baru.
      </p>
      <ActionForm action={confirmEmailChangeAction} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <SubmitButton variant="ink" pendingLabel="Mengonfirmasi…" size="lg" className="w-full">
          Konfirmasi email baru
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-ink-muted">
        <Link href="/" className="font-semibold text-ink underline underline-offset-2">
          Kembali ke toko
        </Link>
      </p>
    </>
  );
}
