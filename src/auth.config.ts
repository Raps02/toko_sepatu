import type { NextAuthConfig } from 'next-auth';
import { can, homePathFor, type Role } from '@/lib/permissions';

// Konfigurasi yang aman untuk edge runtime (tanpa Prisma/bcrypt), dipakai
// oleh middleware. Provider Credentials ditambahkan di `src/auth.ts`.

const CUSTOMER_ONLY_PATHS = ['/cart', '/checkout', '/orders', '/chat', '/account'];
const AUTH_PATHS = ['/login', '/register', '/forgot-password'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const authConfig = {
  trustHost: true,
  // Error login (mis. login Google ditolak atau dibatalkan) juga kembali ke halaman login.
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.sessionVersion = (token.sessionVersion as number | undefined) ?? 0;
      }
      return session;
    },
    // Pemeriksaan kasar di tingkat rute. Pemeriksaan sebenarnya tetap ada di
    // tiap halaman dan server action lewat `src/lib/session.ts`.
    authorized({ auth, request: { nextUrl } }) {
      const role = auth?.user?.role ?? null;
      const { pathname } = nextUrl;

      if (startsWithAny(pathname, AUTH_PATHS)) {
        return role ? Response.redirect(new URL(homePathFor(role), nextUrl)) : true;
      }

      if (startsWithAny(pathname, ['/dashboard'])) {
        if (!role) return false;
        return can(role, 'dashboard.access') ? true : Response.redirect(new URL('/', nextUrl));
      }

      if (startsWithAny(pathname, CUSTOMER_ONLY_PATHS)) {
        if (!role) return false;
        return can(role, 'shop.buy') ? true : Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
