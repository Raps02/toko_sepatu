'use client';

import { createContext, useContext, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from 'react';
import type { ActionResponse, FormAction } from '@/types';
import { Alert } from '@/components/arc/alert/alert';
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog';
import { Button } from '@/components/ui/Button';
import type { ButtonVariant } from '@/components/ui/styles';

type FormState = {
  pending: boolean;
  errors: Record<string, string[] | undefined>;
};

const FormContext = createContext<FormState>({ pending: false, errors: {} });

type ActionFormProps = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Kosongkan isian setelah berhasil (untuk form "tambah"). */
  resetOnSuccess?: boolean;
  /** Tampilkan pesan sukses dari action di dalam form. */
  showSuccess?: boolean;
  /** Minta konfirmasi lewat Dialog Arc sebelum mengirim (untuk tindakan yang tidak bisa dibatalkan). */
  confirmMessage?: string;
  /** Penjelasan singkat di bawah pertanyaan konfirmasi. */
  confirmDescription?: string;
  /** Label tombol setuju di dialog konfirmasi. */
  confirmLabel?: string;
  /** Warna tombol setuju: "danger" untuk hapus/batal, selain itu hitam ink. */
  confirmTone?: 'default' | 'danger';
};

/**
 * Pembungkus form untuk Server Action yang mengembalikan ActionResponse.
 * Mengurus status "sedang mengirim", pesan error, dan error per isian, tanpa
 * mengosongkan isian saat validasi gagal.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  confirmMessage,
  confirmDescription,
  confirmLabel = 'Ya, lanjutkan',
  confirmTone = 'default',
}: ActionFormProps) {
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [pending, startTransition] = useTransition();
  // Form yang menunggu jawaban di dialog konfirmasi. Isinya diambil saat tombol kirim ditekan.
  const [awaiting, setAwaiting] = useState<{ form: HTMLFormElement; formData: FormData } | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (confirmMessage) {
      setAwaiting({ form, formData });
      return;
    }
    send(form, formData);
  }

  function send(form: HTMLFormElement, formData: FormData) {
    startTransition(async () => {
      const response = await action(formData);
      // Action yang berakhir dengan redirect tidak mengembalikan apa-apa.
      if (!response) return;
      setResult(response);
      if (response.success && resetOnSuccess) form.reset();
    });
  }

  const message = result?.message;

  return (
    <FormContext.Provider value={{ pending, errors: result?.success ? {} : (result?.error ?? {}) }}>
      {/* method="post": kalau dikirim sebelum JavaScript siap, isian (termasuk kata sandi) tidak masuk ke URL. */}
      <form method="post" onSubmit={handleSubmit} className={className} noValidate={false}>
        {message && !result.success && (
          <Alert tone="danger" title={message} className="mb-4" />
        )}
        {message && result.success && showSuccess && (
          <Alert tone="success" title={message} className="mb-4" />
        )}
        {result?.devLink && (
          <p className="mb-4 rounded border border-dashed border-marking-dark bg-marking-tint px-3 py-2 text-sm text-ink">
            Mode development: email belum disetel (BREVO_API_KEY kosong), jadi link-nya ditampilkan di sini.{' '}
            <a href={result.devLink} className="break-all font-semibold underline underline-offset-2">
              Buka link dari email
            </a>
          </p>
        )}
        {children}
      </form>
      {confirmMessage && (
        <Dialog open={awaiting !== null} onOpenChange={(open) => !open && setAwaiting(null)}>
          <DialogContent title={confirmMessage} description={confirmDescription}>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Batal</Button>
              </DialogClose>
              <Button
                variant={confirmTone === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  if (!awaiting) return;
                  setAwaiting(null);
                  send(awaiting.form, awaiting.formData);
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </FormContext.Provider>
  );
}

/** Pesan error pertama dari server untuk satu isian, atau undefined. */
export function useFieldError(name: string): string | undefined {
  const { errors } = useContext(FormContext);
  return errors[name]?.[0];
}

export function FieldError({ name }: { name: string }) {
  const { errors } = useContext(FormContext);
  const messages = errors[name];
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-danger">{messages[0]}</p>;
}

type SubmitButtonProps = {
  children: ReactNode;
  /** Dibacakan pembaca layar selama form dikirim; tombol sendiri menampilkan spinner. */
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
};

const noop = () => () => {};

/** true setelah React aktif di browser; false saat render server dan sebelum hydration. */
function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function SubmitButton({ children, pendingLabel, variant = 'primary', size = 'md', className, disabled }: SubmitButtonProps) {
  const { pending } = useContext(FormContext);
  // Sebelum hydration, form belum dipegang ActionForm; kalau dikirim, browser memakai kiriman
  // bawaan (tanpa Server Action). Tombol baru aktif setelah halaman siap.
  const hydrated = useHydrated();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending} disabled={disabled || !hydrated} className={className}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
