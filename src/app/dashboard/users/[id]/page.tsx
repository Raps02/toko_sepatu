import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { deleteUserAction, updateUserAction } from '@/actions/account.actions';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { CheckboxField, SelectField, TextField } from '@/components/ui/Field';
import { accountDeletionBlockers } from '@/lib/account-deletion';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';
import { ROLES } from '@/lib/validations';

export const metadata: Metadata = { title: 'Ubah akun' };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePagePermission('user.manage');
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, _count: { select: { orders: true } } },
  });
  if (!user) notFound();
  const isSelf = user.id === me.id;
  const blockers = isSelf ? [] : await accountDeletionBlockers(user.id);

  return (
    <div className="max-w-xl">
      <ButtonLink href="/dashboard/users" variant="ghost" size="sm" className="mb-3">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Semua akun
      </ButtonLink>
      <PageHeader title={user.name} description={`Terdaftar ${formatDateTime(user.createdAt)}, ${user._count.orders} pesanan`} />

      <Panel title="Data akun">
      <ActionForm action={updateUserAction} className="space-y-4">
        <input type="hidden" name="id" value={user.id} />
        <TextField label="Nama" name="name" defaultValue={user.name} required />
        <TextField label="Email" name="email" type="email" defaultValue={user.email} required />
        <TextField label="Nomor HP" name="phone" type="tel" defaultValue={user.phone ?? ''} />
        <SelectField
          label="Role"
          name="role"
          defaultValue={user.role}
          hint={isSelf ? 'Role akunmu sendiri tidak bisa diturunkan dari sini.' : 'Perubahan role berlaku saat itu juga.'}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </SelectField>
        <CheckboxField
          label="Akun aktif"
          name="isActive"
          defaultChecked={user.isActive}
          hint="Akun nonaktif langsung keluar dan tidak bisa login lagi."
        />
        <TextField
          label="Password baru"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="Kosongkan kalau tidak ingin mengganti password."
        />
        <SubmitButton pendingLabel="Menyimpan…">Simpan perubahan</SubmitButton>
      </ActionForm>
      </Panel>

      {!isSelf && (
        <div className="mt-8">
        <Panel title="Hapus akun" tone="danger">
          {blockers.length > 0 ? (
            <p className="text-sm text-ink-muted">
              Akun ini punya {blockers.join(', ')}. Menghapusnya akan merusak riwayat itu, jadi tidak bisa dihapus.
              Matikan <strong className="font-medium text-ink">Akun aktif</strong> di atas supaya akun ini tidak bisa login lagi.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Akun ini belum punya pesanan atau riwayat kerja, jadi aman dihapus permanen.</p>
              <ActionForm
                action={deleteUserAction.bind(null, user.id)}
                confirmTone="danger" confirmLabel="Ya, hapus" confirmMessage={`Hapus akun ${user.email}? Tindakan ini tidak bisa dibatalkan.`}
                className="mt-4"
              >
                <SubmitButton variant="danger" size="sm" pendingLabel="Menghapus…">
                  Hapus akun ini
                </SubmitButton>
              </ActionForm>
            </>
          )}
        </Panel>
        </div>
      )}
    </div>
  );
}
