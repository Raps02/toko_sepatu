import { NextResponse, type NextRequest } from 'next/server';
import { signOut } from '@/auth';
import { getSessionState } from '@/lib/session';

/**
 * Menghapus cookie sesi yang sudah tidak berlaku (mis. kata sandi diganti di perangkat lain),
 * lalu ke halaman login. Sesi yang masih berlaku tidak disentuh, jadi link ini tidak bisa
 * dipakai pihak lain untuk mengeluarkan orang yang sedang login.
 */
export async function GET(request: NextRequest) {
  const { stale } = await getSessionState();
  if (stale) await signOut({ redirect: false });
  return NextResponse.redirect(new URL(stale ? '/login?sesi=berakhir' : '/login', request.url));
}
