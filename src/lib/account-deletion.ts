import { prisma } from '@/lib/prisma';

/**
 * Alasan sebuah akun tidak boleh dihapus permanen.
 *
 * Menghapus akun ikut menghapus (cascade) atau mengosongkan (SetNull) jejaknya:
 * balasan chat dan pengajuan perubahan hilang, sedangkan "Oleh" di riwayat stok
 * dan pelaku di riwayat audit jadi kosong. Akun yang punya jejak seperti itu
 * cukup dinonaktifkan. Daftar kosong berarti akun aman dihapus.
 */
export async function accountDeletionBlockers(userId: string): Promise<string[]> {
  const [orders, staffMessages, requests, reviewed, movements, audits, replies, handledReturns] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    // Pesan di percakapan milik akun ini sendiri ikut hilang bersama percakapannya, jadi tidak dihitung.
    prisma.message.count({ where: { senderId: userId, conversation: { customerId: { not: userId } } } }),
    prisma.changeRequest.count({ where: { requestedById: userId } }),
    prisma.changeRequest.count({ where: { reviewedById: userId } }),
    prisma.stockMovement.count({ where: { createdById: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.review.count({ where: { repliedById: userId } }),
    prisma.returnRequest.count({ where: { handledById: userId } }),
  ]);

  const blockers: string[] = [];
  if (orders) blockers.push(`${orders} pesanan`);
  if (staffMessages) blockers.push(`${staffMessages} balasan chat`);
  if (requests + reviewed) blockers.push(`${requests + reviewed} pengajuan perubahan`);
  if (movements) blockers.push(`${movements} catatan stok`);
  if (replies) blockers.push(`${replies} balasan review`);
  if (handledReturns) blockers.push(`${handledReturns} retur yang ditangani`);
  if (audits) blockers.push(`${audits} tindakan di riwayat perubahan`);
  return blockers;
}
