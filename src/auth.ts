import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { authConfig } from '@/auth.config';
import { googleLoginEnabled, signInWithGoogleProfile } from '@/lib/google-auth';
import { prisma } from '@/lib/prisma';
import { clearLimit, clientIp, consumeLimit, isLimited, loginRules } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validations';

/** Terlalu banyak gagal login. `code` dibaca loginAction untuk menampilkan pesan yang tepat. */
class TooManyAttempts extends CredentialsSignin {
  code = 'rate_limited';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Batasnya dicek di sini supaya berlaku untuk form login maupun endpoint Auth.js langsung.
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const rules = loginRules(parsed.data.email, clientIp(request.headers));
        if (await isLimited(rules)) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Akun yang dibuat lewat Google tidak punya password.
        const passwordMatches =
          user?.isActive && user.passwordHash ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
        if (!user || !passwordMatches) {
          await Promise.all(rules.map(consumeLimit));
          return null;
        }
        await clearLimit(rules[0]);

        return { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
      },
    }),
    // Kunci dibaca otomatis dari AUTH_GOOGLE_ID dan AUTH_GOOGLE_SECRET. Tanpa kunci,
    // provider tidak didaftarkan dan tombol Google tidak tampil.
    ...(googleLoginEnabled() ? [Google] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Login Google: cek akun, sambungkan, atau buat akun pembeli (src/lib/google-auth.ts).
     * Mengembalikan alamat berarti ditolak dan pengunjung diarahkan ke halaman login dengan pesannya.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!profile?.sub || !profile.email) return '/login?error=google-failed';

      const result = await signInWithGoogleProfile({
        sub: profile.sub,
        email: profile.email,
        emailVerified: profile.email_verified === true,
        name: profile.name ?? '',
      });
      return result.ok ? true : `/login?error=google-${result.reason}`;
    },
    async jwt(params) {
      const { token, account } = params;
      // Profil dari Google belum memakai id dan role toko: ambil dari akun yang baru dicek/dibuat.
      if (account?.provider === 'google') {
        const user = await prisma.user.findUnique({
          where: { googleId: account.providerAccountId },
          select: { id: true, role: true, name: true, sessionVersion: true },
        });
        if (!user) return null;
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.sessionVersion = user.sessionVersion;
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});
