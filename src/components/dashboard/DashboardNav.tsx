'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  ClipboardCheck,
  FileBarChart,
  History,
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Tags,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { can, type Permission, type Role } from '@/lib/permissions';

type NavItem = { href: string; label: string; icon: LucideIcon; anyOf: Permission[] };
type NavGroup = { heading: string | null; items: NavItem[] };

// Menu disaring dari matriks izin yang sama dengan yang dipakai server action.
const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [{ href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard, anyOf: ['dashboard.access'] }],
  },
  {
    heading: 'Operasional',
    items: [
      { href: '/dashboard/orders', label: 'Order', icon: ShoppingCart, anyOf: ['order.process'] },
      { href: '/dashboard/returns', label: 'Retur', icon: Undo2, anyOf: ['return.handle'] },
      { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare, anyOf: ['chat.reply'] },
      { href: '/dashboard/reviews', label: 'Review', icon: Star, anyOf: ['review.reply'] },
    ],
  },
  {
    heading: 'Katalog dan stok',
    items: [
      { href: '/dashboard/products', label: 'Produk', icon: Package, anyOf: ['product.manage'] },
      { href: '/dashboard/pricing', label: 'Harga & diskon', icon: Tags, anyOf: ['price.apply', 'price.request'] },
      { href: '/dashboard/stock', label: 'Stok', icon: Boxes, anyOf: ['stock.manage'] },
      { href: '/dashboard/approvals', label: 'Persetujuan', icon: ClipboardCheck, anyOf: ['approval.review', 'approval.request'] },
    ],
  },
  {
    heading: 'Keuangan dan sistem',
    items: [
      { href: '/dashboard/reports', label: 'Laporan keuangan', icon: FileBarChart, anyOf: ['report.finance.daily'] },
      { href: '/dashboard/shipping', label: 'Ongkir', icon: Truck, anyOf: ['shipping.manage'] },
      { href: '/dashboard/users', label: 'Akun', icon: Users, anyOf: ['user.manage'] },
      { href: '/dashboard/audit', label: 'Riwayat perubahan', icon: History, anyOf: ['audit.view'] },
    ],
  },
];

/** Item aktif memakai isian tenang di tempat (permukaan putih bergaris), bukan sorotan yang berpindah. */
const ACTIVE = 'bg-white text-ink ring-1 ring-studio-line shadow-[0_1px_2px_rgb(17_17_17/0.04)]';
const IDLE = 'text-ink-soft hover:bg-white/70 hover:text-ink';

export function DashboardNav({ role, badges = {} }: { role: Role; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.anyOf.some((p) => can(role, p))),
  })).filter((group) => group.items.length > 0);
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Menu dashboard" className="py-2 lg:py-3">
      {/* Ponsel dan tablet: satu baris yang bisa digeser */}
      <ul className="flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:hidden">
        {visibleGroups.flatMap((g) => g.items).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const badge = badges[href] ?? 0;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? `${ACTIVE} font-medium` : IDLE}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
                {badge > 0 && (
                  <span className="tabular rounded-md bg-marking px-1.5 text-xs font-semibold text-ink">
                    {badge}
                    <span className="sr-only"> menunggu</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop: menu berkelompok */}
      <div className="hidden space-y-4 px-3 lg:block">
        {visibleGroups.map((group) => (
          <div key={group.heading ?? 'utama'}>
            {group.heading && <p className="mb-1 px-2.5 text-xs text-ink-muted">{group.heading}</p>}
            <ul className="space-y-px">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                const badge = badges[href] ?? 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${active ? `${ACTIVE} font-medium` : IDLE}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-court' : 'text-ink-muted'}`} aria-hidden />
                      <span className="truncate">{label}</span>
                      {badge > 0 && (
                        <span className="tabular ml-auto min-w-6 rounded-md bg-marking px-1.5 py-px text-center text-xs font-semibold text-ink">
                          {badge}
                          <span className="sr-only"> menunggu</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
