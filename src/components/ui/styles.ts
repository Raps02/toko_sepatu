// Kelas Tailwind yang dipakai berulang, supaya tombol dan isian konsisten.

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'marking' | 'ink' | 'pillSecondary';

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'rounded-lg bg-ink text-white hover:bg-ink-soft shadow-sm',
  secondary: 'rounded-lg border border-pavement-300 bg-white text-ink hover:border-ink hover:bg-studio',
  danger: 'rounded-lg border border-danger/40 bg-white text-danger hover:bg-danger-tint',
  ghost: 'rounded-lg text-ink-muted hover:bg-studio hover:text-ink',
  marking: 'rounded-lg bg-marking text-ink hover:bg-marking-dark',
  ink: 'rounded-full bg-ink text-white hover:bg-ink-soft',
  pillSecondary: 'rounded-full border border-pavement-300 bg-white text-ink hover:border-ink',
};

const buttonSizes = {
  sm: 'px-3.5 py-1.5 text-xs sm:text-sm',
  md: 'px-4 py-2.5 text-sm',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md', extra?: string): string {
  return [buttonBase, buttonVariants[variant], buttonSizes[size], extra].filter(Boolean).join(' ');
}

export const inputClass =
  'block w-full rounded-lg border border-pavement-300 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-asphalt-300 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:bg-studio disabled:text-ink-muted';

export const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

export const hintClass = 'mt-1.5 text-xs text-ink-muted';

/** Panel bersih untuk mengelompokkan isi di dashboard. */
export const panelClass = 'rounded-2xl border border-studio-line bg-white';

export const tableClass = 'w-full text-left text-sm';
// Kepala tabel bernada tenang (huruf biasa, bukan kapital), sejalan dengan tabel Arc.
export const thClass = 'border-b border-studio-line bg-pavement/60 px-4 py-2.5 text-xs font-medium text-ink-muted';
export const tdClass = 'border-b border-studio-line/70 px-4 py-3 align-middle text-ink';
