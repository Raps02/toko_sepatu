import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/permissions';

declare module 'next-auth' {
  interface User {
    role: Role;
    /** Lihat User.sessionVersion di schema.prisma. */
    sessionVersion?: number;
  }

  interface Session {
    user: { id: string; role: Role; sessionVersion: number } & DefaultSession['user'];
  }
}
