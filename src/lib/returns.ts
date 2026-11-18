import type { ReturnStatus } from '@prisma/client';
import type { Tone } from '@/components/dashboard/PageHeader';

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: Tone; customerHint: string }> = {
  REQUESTED: { label: 'Menunggu diperiksa', tone: 'warn', customerHint: 'Toko sedang memeriksa pengajuanmu.' },
  APPROVED: { label: 'Disetujui', tone: 'good', customerHint: 'Kirim barangnya kembali ke toko. Dana dikembalikan setelah barang diterima.' },
  REJECTED: { label: 'Ditolak', tone: 'bad', customerHint: 'Pengajuan ini tidak disetujui.' },
  RECEIVED: { label: 'Barang diterima toko', tone: 'good', customerHint: 'Barang sudah sampai di toko. Dana sedang diproses.' },
  REFUNDED: { label: 'Dana dikembalikan', tone: 'neutral', customerHint: 'Dana sudah dikembalikan.' },
};
