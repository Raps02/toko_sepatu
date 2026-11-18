import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

type AuditEntry = {
  actorId: string | null;
  /** Kata kerja singkat, mis. "price.update", "order.ship", "user.deactivate". */
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

/**
 * Mencatat siapa mengubah apa. Panggil di dalam transaksi yang sama dengan
 * perubahannya (kirim `tx`) supaya catatan dan perubahan tidak bisa terpisah.
 */
export async function logAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before,
      after: entry.after,
    },
  });
}
