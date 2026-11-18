'use server';

import { revalidatePath } from 'next/cache';
import { fail, failFrom, ok, parseForm, UserFacingError } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { applyChange } from '@/lib/change-requests';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/session';
import { reviewChangeSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

/** Admin menyetujui atau menolak pengajuan SPV. */
export async function reviewChangeRequestAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('approval.review');
  if (denied) return denied;

  const { data, invalid } = parseForm(reviewChangeSchema, formData);
  if (invalid) return invalid;

  if (data.decision === 'REJECTED' && !data.reviewNote) {
    return {
      success: false,
      message: 'Tulis alasan penolakan supaya pengaju tahu apa yang perlu diperbaiki.',
      error: { reviewNote: ['Alasan wajib diisi saat menolak'] },
    };
  }

  try {
    const paths = await prisma.$transaction(async (tx) => {
      // Klaim pengajuan hanya kalau masih PENDING, supaya dua admin yang
      // menekan tombol bersamaan tidak menerapkan perubahan dua kali.
      const claimed = await tx.changeRequest.updateMany({
        where: { id: data.id, status: 'PENDING' },
        data: {
          status: data.decision,
          reviewedById: user.id,
          reviewNote: data.reviewNote ?? null,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) throw new UserFacingError('Pengajuan ini sudah diputuskan sebelumnya.');

      const request = await tx.changeRequest.findUniqueOrThrow({ where: { id: data.id } });
      const touched = data.decision === 'APPROVED' ? await applyChange(tx, request.type, request.payload, user.id, request.reason) : [];

      await logAudit(tx, {
        actorId: user.id,
        action: data.decision === 'APPROVED' ? 'approval.approve' : 'approval.reject',
        entity: 'ChangeRequest',
        entityId: request.id,
        after: { type: request.type, summary: request.summary, reviewNote: data.reviewNote ?? null },
      });
      return touched;
    });

    revalidatePath('/dashboard', 'layout');
    for (const path of paths) revalidatePath(path);
    return ok(data.decision === 'APPROVED' ? 'Disetujui dan langsung diterapkan.' : 'Pengajuan ditolak.');
  } catch (error) {
    return failFrom(error, 'Keputusan belum bisa disimpan.');
  }
}

/** Pengaju membatalkan pengajuannya sendiri selama belum diputuskan. */
export async function cancelChangeRequestAction(requestId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('approval.request');
  if (denied) return denied;

  const deleted = await prisma.changeRequest.deleteMany({
    where: { id: requestId, requestedById: user.id, status: 'PENDING' },
  });
  if (deleted.count === 0) return fail('Pengajuan ini sudah diputuskan atau bukan milikmu.');

  revalidatePath('/dashboard', 'layout');
  return ok('Pengajuan dibatalkan.');
}
