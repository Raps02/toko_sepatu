'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, LayoutDashboard, LogOut, Menu, MessageSquare, Package, ShoppingBag, User } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/arc/drawer/drawer';
import { logoutAction } from '@/actions/auth.actions';
import { Badge } from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { SearchInput } from '@/components/ui/Field';

type NavCategory = { name: string; slug: string };

type Props = {
  categories: NavCategory[];
  userName?: string | null;
  isCustomer: boolean;
  isStaff: boolean;
  cartCount: number;
};

export function MobileNav({ categories, userName, isCustomer, isStaff, cartCount }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" aria-label="Buka menu navigasi" className="!px-2.5 xl:!hidden">
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
      </DrawerTrigger>

      <DrawerContent title="Menu" side="right" className="xl:hidden">
        <form action="/products" onSubmit={() => setOpen(false)}>
          <SearchInput id="mobile-search" label="Cari sepatu" name="q" placeholder="Cari sepatu atau merek" hideLabel />
        </form>

        <nav className="mt-6 space-y-1" aria-label="Kategori sepatu">
          <Link
            href="/products?sort=terbaru"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between py-2.5 text-base font-semibold text-ink"
          >
            Baru &amp; Unggulan
            <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
          </Link>
          {[
            { href: '/products?gender=pria', label: 'Pria' },
            { href: '/products?gender=wanita', label: 'Wanita' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between py-2.5 text-base font-semibold text-ink"
            >
              {item.label}
              <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
            </Link>
          ))}
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between py-2.5 text-base font-semibold text-ink"
            >
              {cat.name}
              <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
            </Link>
          ))}
          <Link
            href="/products"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between py-2.5 text-base font-semibold text-ink"
          >
            Semua Sepatu
            <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
          </Link>
        </nav>

        <div className="mt-6 border-t border-studio-line pt-5">
          {userName ? (
            <div className="space-y-1">
              <p className="mb-2 text-sm font-medium text-ink-muted">{userName}</p>
              {isStaff && (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 py-2 text-sm font-medium text-ink"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Dashboard Toko
                </Link>
              )}
              {isCustomer && (
                <>
                  <Link
                    href="/cart"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-2 text-sm font-medium text-ink"
                  >
                    <span className="flex items-center gap-3">
                      <ShoppingBag className="h-4 w-4" aria-hidden />
                      Keranjang
                    </span>
                    {cartCount > 0 && (
                      <Badge tone="dark">{cartCount}</Badge>
                    )}
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-2 text-sm font-medium text-ink"
                  >
                    <Package className="h-4 w-4" aria-hidden />
                    Pesanan Saya
                  </Link>
                  <Link
                    href="/chat"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-2 text-sm font-medium text-ink"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    Chat Toko
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-2 text-sm font-medium text-ink"
                  >
                    <User className="h-4 w-4" aria-hidden />
                    Akun &amp; Alamat
                  </Link>
                </>
              )}
              <form action={logoutAction} className="pt-2">
                <Button type="submit" variant="ghost" className="!px-0">
                  <LogOut className="h-4 w-4" aria-hidden />
                  Keluar
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">Masuk untuk menyimpan keranjang, cek pesanan, dan checkout lebih cepat.</p>
              <div className="flex gap-2.5">
                <ButtonLink href="/register" onClick={() => setOpen(false)} variant="primary" pill className="flex-1">
                  Daftar
                </ButtonLink>
                <ButtonLink href="/login" onClick={() => setOpen(false)} pill className="flex-1">
                  Masuk
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
