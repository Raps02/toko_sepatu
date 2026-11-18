import type { Metadata } from 'next';
import { deleteAddressAction, setDefaultAddressAction, updateProfileAction } from '@/actions/account.actions';
import { changePasswordAction, requestEmailChangeAction } from '@/actions/security.actions';
import { Alert } from '@/components/arc/alert/alert';
import { Badge } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { AddressForm } from '@/components/shop/AddressForm';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextField } from '@/components/ui/Field';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Akun' };

type Props = { searchParams: Promise<{ berhasil?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await requirePagePermission('shop.buy');

  const [profile, addresses, rates] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, passwordHash: true, googleId: true },
    }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.shippingRate.findMany({ orderBy: { province: 'asc' }, select: { province: true } }),
  ]);
  const hasPassword = Boolean(profile.passwordHash);
  const passwordSaved = (await searchParams).berhasil === 'password';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Akun &amp; Alamat</h1>
      <p className="mt-1 text-sm text-ink-muted">Data diri, keamanan akun, dan alamat pengiriman yang dipakai saat checkout.</p>

      <div className="mt-6">
        <Panel title="Profil">
        <ActionForm action={updateProfileAction} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nama lengkap" name="name" defaultValue={profile.name} required />
          <TextField label="Nomor HP" name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ''} hint="Dipakai kurir kalau perlu menghubungi kamu." />
          <div className="sm:col-span-2">
            <SubmitButton variant="ink" pendingLabel="Menyimpan…" className="px-6">
              Simpan profil
            </SubmitButton>
          </div>
        </ActionForm>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Email &amp; keamanan">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Email</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Sekarang: <span className="font-semibold text-ink">{profile.email}</span>. Email dipakai untuk masuk dan menerima kabar pesanan.
            </p>
            <ActionForm action={requestEmailChangeAction} className="mt-4 space-y-4">
              <TextField label="Email baru" name="email" type="email" autoComplete="email" spellCheck={false} required />
              {hasPassword && (
                <TextField label="Kata sandi saat ini" name="emailPassword" type="password" autoComplete="current-password" required />
              )}
              <SubmitButton variant="secondary" pendingLabel="Mengirim…">
                Kirim link konfirmasi
              </SubmitButton>
            </ActionForm>
            <p className="mt-2 text-xs text-ink-muted">Email baru berlaku setelah kamu klik link konfirmasi yang kami kirim ke alamat itu.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">{hasPassword ? 'Ganti kata sandi' : 'Buat kata sandi'}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {hasPassword
                ? 'Setelah diganti, semua perangkat lain otomatis keluar.'
                : 'Akunmu dibuat lewat Google. Buat kata sandi supaya bisa masuk juga dengan email dan kata sandi.'}
            </p>
            {passwordSaved && <Alert tone="success" title="Kata sandi disimpan." className="mt-3" />}
            <ActionForm action={changePasswordAction} className="mt-4 space-y-4">
              {/* Untuk pengelola kata sandi browser: kata sandi ini milik email akun. */}
              <input type="email" name="username" autoComplete="username" value={profile.email} readOnly hidden />
              {hasPassword && (
                <TextField label="Kata sandi saat ini" name="currentPassword" type="password" autoComplete="current-password" required />
              )}
              <TextField
                label="Kata sandi baru"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                hint="Minimal 8 karakter."
              />
              <SubmitButton variant="secondary" pendingLabel="Menyimpan…">
                {hasPassword ? 'Ganti kata sandi' : 'Buat kata sandi'}
              </SubmitButton>
            </ActionForm>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-studio-line pt-5 text-sm">
          <div>
            <p className="font-semibold text-ink">Masuk dengan Google</p>
            <p className="text-ink-muted">
              {profile.googleId
                ? 'Akun Google sudah tersambung. Kamu bisa masuk lewat tombol Google di halaman login.'
                : 'Belum tersambung. Masuk sekali lewat tombol Google dengan email yang sama untuk menyambungkannya.'}
            </p>
          </div>
          <Badge tone={profile.googleId ? 'good' : 'neutral'}>{profile.googleId ? 'Tersambung' : 'Belum tersambung'}</Badge>
        </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Alamat pengiriman">
        {addresses.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada alamat. Tambahkan satu supaya bisa checkout.</p>
        ) : (
          <ul className="divide-y divide-studio-line border-y border-studio-line">
            {addresses.map((address) => (
              <li key={address.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {address.label}: {address.recipient} {address.isDefault && <Badge tone="good">Utama</Badge>}
                  </p>
                  <p className="text-asphalt-500">{address.phone}</p>
                  <p>
                    {address.street}, {address.city}, {address.province} {address.postalCode}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!address.isDefault && (
                    <ActionForm action={setDefaultAddressAction.bind(null, address.id)} showSuccess={false}>
                      <SubmitButton variant="ghost" size="sm">
                        Jadikan utama
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={deleteAddressAction.bind(null, address.id)} confirmTone="danger" confirmLabel="Ya, hapus" confirmMessage={`Hapus alamat “${address.label}”?`} showSuccess={false}>
                    <SubmitButton variant="ghost" size="sm">
                      Hapus
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-3 mt-6 text-sm font-semibold">Tambah alamat baru</h3>
        <AddressForm provinces={rates.map((r) => r.province)} defaultRecipient={profile.name} />
        </Panel>
      </div>
    </div>
  );
}
