import type { Metadata } from 'next';
import Link from 'next/link';
import { createUserAction } from '@/actions/account.actions';
import { Alert } from '@/components/arc/alert/alert';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { SearchInput, SelectField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL, type Role } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';
import { ROLES } from '@/lib/validations';

export const metadata: Metadata = { title: 'Akun' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; dihapus?: string }> }) {
  const me = await requirePagePermission('user.manage');
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? '';
  const role = ROLES.includes(params.role as Role) ? (params.role as Role) : null;

  const users = await prisma.user.findMany({
    where: {
      ...(role && { role }),
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }),
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, _count: { select: { orders: true } } },
  });

  return (
    <>
      <PageHeader
        title="Akun"
        description="Buat akun staf (Admin atau Supervisor), ubah role, atau nonaktifkan akun. Pembeli mendaftar mandiri dari halaman Daftar."
      />

      {params.dihapus && <Alert tone="success" title={`Akun ${params.dihapus.slice(0, 120)} dihapus.`} className="mb-5" />}

      <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
        <section>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <SearchInput label="Cari akun" name="q" defaultValue={q} placeholder="Nama atau email" wrapperClassName="min-w-48 flex-1" />
            <SelectField id="filter-role" label="Role" name="role" defaultValue={role ?? ''} wrapperClassName="w-40">
              <option value="">Semua role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
            <Button type="submit" variant="secondary">
              Cari
            </Button>
          </form>

          <DataTable
            caption="Daftar akun"
            emptyMessage="Tidak ada akun yang cocok dengan pencarian ini."
            columns={[
              { key: 'name', label: 'Nama' },
              { key: 'role', label: 'Role' },
              { key: 'orders', label: 'Pesanan', numeric: true },
              { key: 'created', label: 'Terdaftar' },
              { key: 'status', label: 'Status' },
            ]}
            rows={users.map((user) => ({
              id: user.id,
              sort: {
                name: user.name,
                role: ROLE_LABEL[user.role],
                orders: user._count.orders,
                created: user.createdAt.getTime(),
                status: user.isActive ? 'Aktif' : 'Nonaktif',
              },
              cells: {
                name: (
                  <>
                    <Link href={`/dashboard/users/${user.id}`} className="font-medium text-ink hover:underline">
                      {user.name}
                    </Link>
                    {user.id === me.id && <span className="ml-2 text-xs text-ink-muted">(kamu)</span>}
                    <p className="break-all text-xs text-ink-muted">{user.email}</p>
                  </>
                ),
                role: <Badge tone={user.role === 'ADMIN' ? 'dark' : user.role === 'SPV' ? 'warn' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>,
                orders: user._count.orders,
                created: <span className="text-xs text-ink-muted">{formatDate(user.createdAt)}</span>,
                status: user.isActive ? <Badge tone="good">Aktif</Badge> : <Badge tone="bad">Nonaktif</Badge>,
              },
            }))}
          />
        </section>

        <aside className="h-fit">
          <Panel title="Buat akun baru">
          <ActionForm action={createUserAction} resetOnSuccess className="space-y-3">
            <TextField label="Nama" name="name" required />
            <TextField label="Email" name="email" type="email" required />
            <TextField label="Nomor HP" name="phone" type="tel" />
            <SelectField label="Role" name="role" defaultValue="SPV">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Password awal"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint="Minimal 8 karakter. Sampaikan ke pemilik akun lewat jalur aman."
            />
            <SubmitButton pendingLabel="Membuat…" className="w-full">
              Buat akun
            </SubmitButton>
          </ActionForm>
          </Panel>
        </aside>
      </div>
    </>
  );
}
