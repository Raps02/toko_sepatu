import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, LogOut } from 'lucide-react';
import { logoutAction } from '@/actions/auth.actions';
import { Avatar } from '@/components/arc/avatar/avatar';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { BrandMark } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { unreadByStaff } from '@/lib/chat';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Dashboard', template: `%s | Dashboard ${SITE.name}` } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission('dashboard.access');

  // Angka kecil di menu: pekerjaan yang sedang menunggu ditangani.
  const [ordersToProcess, pendingApprovals, openReturns, unreadChats] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    can(user.role, 'approval.review')
      ? prisma.changeRequest.count({ where: { status: 'PENDING' } })
      : prisma.changeRequest.count({ where: { status: 'PENDING', requestedById: user.id } }),
    prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED'] } } }),
    prisma.conversation.count({ where: { OR: [{ needsStaff: true }, { messages: { some: unreadByStaff } }] } }),
  ]);

  const badges = {
    '/dashboard/orders': ordersToProcess,
    '/dashboard/approvals': pendingApprovals,
    '/dashboard/returns': openReturns,
    '/dashboard/chat': unreadChats,
  };

  const workspace = (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg p-1.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
        <BrandMark className="h-4 w-6" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-lg font-semibold uppercase tracking-tight text-ink">{SITE.name}</span>
        <span className="block truncate text-xs text-ink-muted">Dashboard {ROLE_LABEL[user.role].toLowerCase()}</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-pavement text-ink print:block print:bg-white lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        {/* Ponsel dan tablet: identitas toko, lalu menu bergeser ke samping */}
        <div className="flex items-center justify-between gap-3 px-3 pt-3 lg:hidden">
          {workspace}
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </Button>
          </form>
        </div>

        <div className="hidden px-3 pt-3 lg:block">{workspace}</div>

        <div className="lg:flex-1 lg:overflow-y-auto">
          <DashboardNav role={user.role} badges={badges} />
        </div>

        <div className="hidden p-3 lg:block">
          <div className="flex items-center gap-2.5 rounded-lg p-1.5">
            <Avatar name={user.name} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-muted">{user.email}</span>
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
            <ButtonLink href="/" variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Lihat toko
            </ButtonLink>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4" aria-hidden />
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Bingkai kerja: permukaan putih yang mengambang di atas kanvas, seperti layar aplikasi */}
      <div className="min-w-0 px-2 pb-2 print:p-0 lg:py-2 lg:pl-0 lg:pr-2">
        <main className="min-h-[calc(100vh-1rem)] rounded-2xl border border-studio-line bg-white shadow-[0_1px_2px_rgb(17_17_17/0.04)] print:min-h-0 print:rounded-none print:border-0 print:shadow-none">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
