import type { z } from 'zod';
import type { ActionResponse } from '@/types';

type Parsed<T> = { data: T; invalid: null } | { data: null; invalid: ActionResponse };

/** Validasi FormData dengan skema Zod; hasil gagal sudah berbentuk ActionResponse. */
export function parseForm<S extends z.ZodTypeAny>(schema: S, formData: FormData): Parsed<z.infer<S>> {
  const raw: Record<string, FormDataEntryValue | null> = {};
  for (const key of new Set(formData.keys())) raw[key] = formData.get(key);

  const result = schema.safeParse(raw);
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten();
    return {
      data: null,
      invalid: {
        success: false,
        message: formErrors[0] ?? 'Ada isian yang belum benar. Periksa lagi bagian yang ditandai.',
        error: fieldErrors as Record<string, string[] | undefined>,
      },
    };
  }
  return { data: result.data, invalid: null };
}

export function fail(message: string): ActionResponse {
  return { success: false, message };
}

export function ok(message?: string): ActionResponse {
  return { success: true, message };
}

/** Kesalahan yang pesannya aman ditampilkan ke pengguna (mis. "stok habis"). */
export class UserFacingError extends Error {}

/** Mengubah error tak terduga menjadi ActionResponse tanpa membocorkan detail internal. */
export function failFrom(error: unknown, fallback: string): ActionResponse {
  if (error instanceof UserFacingError) return fail(error.message);
  console.error(fallback, error);
  return fail(fallback);
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
