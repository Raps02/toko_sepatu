import Link from "next/link";
import {
  LayoutDashboard,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import { MobileNav } from "@/components/shop/MobileNav";
import { Badge } from "@/components/dashboard/PageHeader";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SearchInput } from "@/components/ui/Field";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { SITE, STORE_CONTACT } from "@/lib/site";

const navItemClass =
  "relative whitespace-nowrap py-5 text-[15px] font-semibold text-ink transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:origin-center after:scale-x-0 after:bg-ink after:transition-transform hover:text-ink-muted hover:after:scale-x-100";

const utilityLinkClass =
  "whitespace-nowrap text-xs font-medium text-ink transition-colors hover:text-ink-muted";

export async function SiteHeader() {
  const [user, categories] = await Promise.all([
    getCurrentUser(),
    prisma.category.findMany({
      where: { products: { some: { isPublished: true } } },
      orderBy: { name: "asc" },
      take: 6,
      select: { name: true, slug: true },
    }),
  ]);

  const isCustomer = can(user?.role, "shop.buy");
  const isStaff = can(user?.role, "dashboard.access");

  const cartCount =
    isCustomer && user
      ? ((
          await prisma.cartItem.aggregate({
            where: { userId: user.id },
            _sum: { quantity: true },
          })
        )._sum.quantity ?? 0)
      : 0;

  return (
    <>
      {/* Strip atas: janji toko di kiri, urusan akun di kanan (akun di HP ada di menu). */}
      <div className="border-b border-studio-line bg-studio">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-center gap-6 px-4 text-xs text-ink sm:justify-between sm:px-8 lg:px-12">
          <ul className="flex items-center gap-5" aria-label="Layanan toko">
            <li className="inline-flex items-center gap-1.5">
              <Truck className="hidden h-3.5 w-3.5 shrink-0 text-ink-muted min-[400px]:block" aria-hidden />
              Gratis ongkir beli 2 pasang
            </li>
            <li className="inline-flex items-center gap-1.5">
              <RefreshCw className="hidden h-3.5 w-3.5 shrink-0 text-ink-muted min-[400px]:block" aria-hidden />
              Tukar ukuran 7 hari
            </li>
          </ul>

          <nav aria-label="Akun" className="hidden items-center gap-5 sm:flex">
            {isStaff && (
              <Link href="/dashboard" className={`${utilityLinkClass} inline-flex items-center gap-1.5 font-semibold`}>
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                Dashboard toko
              </Link>
            )}

            {isCustomer && (
              <>
                <Link href="/orders" className={utilityLinkClass}>
                  Pesanan saya
                </Link>
                <Link href="/account" className={`${utilityLinkClass} font-semibold`}>
                  Hai, {user?.name.split(" ")[0]}
                </Link>
              </>
            )}

            {user ? (
              <form action={logoutAction} className="inline-flex">
                <Button type="submit" variant="ghost" size="sm" className="!min-h-0 !px-2 !py-0.5 !text-xs">
                  Keluar
                </Button>
              </form>
            ) : (
              <>
                <Link href="/register" className={utilityLinkClass}>
                  Daftar
                </Link>
                <Link href="/login" className={`${utilityLinkClass} font-semibold`}>
                  Masuk
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Main sticky navbar */}
      <header className="sticky top-0 z-40 border-b border-studio-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="flex shrink-0 items-center focus-visible:outline-ink"
          >
            <BrandLogo tone="dark" size="md" />
          </Link>

          <nav
            className="hidden items-center gap-7 xl:flex"
            aria-label="Navigasi utama"
          >
            <Link href="/products?sort=terbaru" className={navItemClass}>
              Baru &amp; Unggulan
            </Link>
            <Link href="/products?gender=pria" className={navItemClass}>
              Pria
            </Link>
            <Link href="/products?gender=wanita" className={navItemClass}>
              Wanita
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                className={navItemClass}
              >
                {category.name}
              </Link>
            ))}
            <Link href="/products" className={navItemClass}>
              Semua Sepatu
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <form action="/products" className="hidden w-44 sm:block md:w-56">
              <SearchInput id="site-search" label="Cari sepatu" name="q" placeholder="Cari sepatu" hideLabel />
            </form>

            {isCustomer ? (
              <ButtonLink
                href="/cart"
                variant="ghost"
                pill
                aria-label={`Keranjang belanja${cartCount > 0 ? `, ${cartCount} barang` : ""}`}
                className="relative !px-2.5"
              >
                <ShoppingBag className="h-5 w-5" aria-hidden />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1">
                    <Badge tone="dark">{cartCount}</Badge>
                  </span>
                )}
              </ButtonLink>
            ) : !user ? (
              <ButtonLink href="/login" variant="primary" size="sm" pill className="max-sm:!hidden">
                Masuk
              </ButtonLink>
            ) : null}

            <MobileNav
              categories={categories}
              userName={user?.name}
              isCustomer={isCustomer}
              isStaff={isStaff}
              cartCount={cartCount}
            />
          </div>
        </div>
      </header>

    </>
  );
}

export async function SiteFooter() {
  const categories = await prisma.category.findMany({
    where: { products: { some: { isPublished: true } } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Belanja Sepatu
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-asphalt-300">
              <li>
                <Link
                  href="/products"
                  className="transition-colors hover:text-white"
                >
                  Semua Sepatu
                </Link>
              </li>
              <li>
                <Link
                  href="/products?sort=terbaru"
                  className="transition-colors hover:text-white"
                >
                  Baru Datang
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="transition-colors hover:text-white"
                  >
                    Sepatu {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Layanan Pelanggan
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-asphalt-300">
              <li>
                <Link
                  href="/orders"
                  className="transition-colors hover:text-white"
                >
                  Status Pesanan
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="transition-colors hover:text-white"
                >
                  Keranjang Belanja
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="transition-colors hover:text-white"
                >
                  Akun &amp; Alamat Pengiriman
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="transition-colors hover:text-white"
                >
                  Tanya Toko
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Tentang {SITE.name}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-asphalt-300">
              <li>Stok Terverifikasi per Ukuran</li>
              <li>Garansi Tukar Ukuran 7 Hari</li>
              <li>Gratis Ongkir Beli Min. 2 Pasang</li>
              <li>Pembayaran Online Aman</li>
            </ul>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              {STORE_CONTACT.address && (
                <address className="inline-flex items-center gap-2 text-sm not-italic leading-relaxed text-asphalt-300">
                  <MapPin className="h-4 w-4 shrink-0 text-white" aria-hidden />
                  <span>
                    <span className="block font-semibold text-white">
                      Toko {SITE.name}
                    </span>
                    {STORE_CONTACT.address}
                  </span>
                </address>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 text-xs text-asphalt-300">
          <div className="flex items-center gap-3">
            <BrandLogo tone="light" size="sm" />
            <span>© 2026 {SITE.name} Indonesia.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
