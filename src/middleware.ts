import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Lewati aset statis, gambar unggahan, dan semua route handler (/api).
  matcher: ['/((?!api|_next/static|_next/image|uploads|images|favicon.ico|icon.svg).*)'],
};
