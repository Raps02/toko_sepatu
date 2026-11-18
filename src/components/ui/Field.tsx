'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Checkbox } from '@/components/arc/checkbox/checkbox';
import { Combobox, type ComboboxOption } from '@/components/arc/combobox/combobox';
import { DatePicker } from '@/components/arc/date-picker/date-picker';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { Input } from '@/components/arc/input/input';
import { PasswordField } from '@/components/arc/password-field/password-field';
import { SearchField } from '@/components/arc/search-field/search-field';
import { Select } from '@/components/arc/select/select';
import { Textarea } from '@/components/arc/textarea/textarea';
import { FieldError, useFieldError } from '@/components/ui/ActionForm';

// Isian form toko di atas komponen Arc. Props-nya sama dengan versi lama,
// jadi halaman yang memakainya tidak perlu diubah. Error dari Server Action
// (lewat ActionForm) tampil di bawah isian.

type Shared = { label: string; name: string; hint?: string; wrapperClassName?: string };

export function TextField({ label, name, hint, wrapperClassName, type, ...input }: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const error = useFieldError(name);
  const field =
    type === 'password' ? (
      <PasswordField
        id={name}
        name={name}
        label={label}
        description={hint}
        aria-invalid={error ? true : undefined}
        messages={{ showPassword: 'Tampilkan kata sandi', hidePassword: 'Sembunyikan kata sandi' }}
        {...input}
      />
    ) : (
      <Input id={name} name={name} type={type} label={label} description={hint} error={error} {...input} />
    );
  return (
    <div className={wrapperClassName}>
      {field}
      {type === 'password' && <FieldError name={name} />}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  wrapperClassName,
  ...textarea
}: Shared & { hideLabel?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const error = useFieldError(name);
  return (
    <div className={wrapperClassName}>
      <Textarea id={name} name={name} rows={3} label={label} description={hint} error={error} {...textarea} />
    </div>
  );
}

/** Radix Select tidak menerima nilai kosong, jadi opsi bernilai "" diganti penanda ini di dalam komponen. */
const EMPTY = '__kosong__';

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/**
 * Pilihan dengan <option> sebagai children, seperti <select> biasa. Nilainya
 * dikirim lewat input tersembunyi, jadi FormData tetap berisi `name` dengan
 * nilai aslinya (termasuk "" untuk opsi kosong).
 */
export function SelectField({
  id,
  label,
  name,
  hint,
  wrapperClassName,
  children,
  defaultValue,
  disabled,
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const options = Children.toArray(children)
    .filter((child): child is ReactElement<OptionProps> => isValidElement(child))
    .map((option) => {
      const value = String(option.props.value ?? textOf(option.props.children));
      return { value: value === '' ? EMPTY : value, label: textOf(option.props.children), disabled: option.props.disabled };
    });
  const initial = defaultValue == null ? '' : String(defaultValue);
  const [value, setValue] = useState(initial === '' && options.some((o) => o.value === EMPTY) ? EMPTY : initial);

  return (
    <div className={wrapperClassName}>
      <Select
        id={id ?? name}
        label={label}
        description={hint}
        options={options}
        value={value}
        onValueChange={setValue}
        disabled={disabled}
      />
      <input type="hidden" name={name} value={value === EMPTY ? '' : value} />
      <FieldError name={name} />
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  defaultChecked,
  disabled,
}: { label: string; name: string; hint?: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <div>
      <Checkbox id={name} name={name} label={label} description={hint} defaultChecked={defaultChecked} disabled={disabled} />
      <FieldError name={name} />
    </div>
  );
}

/** Menjalankan `onReset` saat form pemilik input tersembunyi ini di-reset (mis. `resetOnSuccess`). */
function useFormReset(onReset: () => void) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [onReset]);
  return ref;
}

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return key ? new Date(year!, month! - 1, day) : undefined;
};
const keyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Pilihan tanggal Arc. Nilainya dikirim sebagai YYYY-MM-DD, sama seperti <input type="date">. */
export function DateField({
  label,
  name,
  hint,
  wrapperClassName,
  defaultValue = '',
  min,
  max,
}: Shared & { defaultValue?: string; min?: string; max?: string }) {
  const [value, setValue] = useState(defaultValue);
  const reset = useCallback(() => setValue(defaultValue), [defaultValue]);
  const ref = useFormReset(reset);
  return (
    <div className={wrapperClassName}>
      <DatePicker
        id={name}
        label={label}
        description={hint}
        value={dateFromKey(value)}
        onChange={(date) => setValue(date ? keyFromDate(date) : '')}
        minDate={min ? dateFromKey(min) : undefined}
        maxDate={max ? dateFromKey(max) : undefined}
      />
      <input ref={ref} type="hidden" name={name} value={value} />
      <FieldError name={name} />
    </div>
  );
}

/** Pilihan panjang yang bisa dicari. Nilai aslinya dikirim lewat input tersembunyi. */
export function ComboboxField({
  id,
  label,
  name,
  hint,
  wrapperClassName,
  options,
  defaultValue = '',
  placeholder,
  emptyMessage,
  required,
}: Shared & {
  id?: string;
  options: ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const reset = useCallback(() => setValue(defaultValue), [defaultValue]);
  const ref = useFormReset(reset);
  return (
    <div className={wrapperClassName}>
      <Combobox
        id={id ?? name}
        label={label}
        description={hint}
        options={options}
        value={value}
        onValueChange={setValue}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        required={required}
      />
      <input ref={ref} type="hidden" name={name} value={value} />
      <FieldError name={name} />
    </div>
  );
}

/** Kotak pencarian untuk form GET. */
export function SearchInput({
  id,
  label,
  name,
  wrapperClassName,
  defaultValue = '',
  placeholder,
  hideLabel,
}: Omit<Shared, 'hint'> & { id?: string; defaultValue?: string; placeholder?: string; hideLabel?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className={wrapperClassName}>
      <SearchField id={id ?? name} name={name} label={label} hideLabel={hideLabel} value={value} onValueChange={setValue} placeholder={placeholder} />
    </div>
  );
}

/** Unggah satu file lewat FileDropzone Arc. File yang dipilih ikut terkirim bersama form. */
export function FileField({
  label,
  name,
  description,
  note,
  accept,
  maxSize,
  required,
}: {
  label: string;
  name: string;
  description?: string;
  note?: string;
  accept?: string;
  maxSize?: number;
  required?: boolean;
}) {
  // Dropzone menyimpan daftarnya sendiri, jadi saat form di-reset komponennya dibuat ulang.
  const [version, setVersion] = useState(0);
  const reset = useCallback(() => setVersion((current) => current + 1), []);
  const ref = useFormReset(reset);

  function select(files: File[]) {
    if (!ref.current) return;
    const transfer = new DataTransfer();
    for (const file of files) if (!maxSize || file.size <= maxSize) transfer.items.add(file);
    ref.current.files = transfer.files;
  }

  return (
    <div>
      <FileDropzone
        key={version}
        label={label}
        description={description}
        note={note}
        accept={accept}
        maxSize={maxSize}
        multiple={false}
        maxFiles={1}
        onFilesChange={select}
      />
      <input ref={ref} type="file" name={name} accept={accept} required={required} tabIndex={-1} aria-hidden className="sr-only" />
      <FieldError name={name} />
    </div>
  );
}
