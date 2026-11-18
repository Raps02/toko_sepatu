'use client';

import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Baris pertama adalah judul kolom. Kosongkan untuk menyembunyikan tombol unduh. */
  csvRows?: (string | number)[][];
  filename: string;
};

function toCsv(rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value);
    // Awalan = + - @ dinetralkan supaya tidak dijalankan sebagai rumus di Excel.
    const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export function ReportActions({ csvRows, filename }: Props) {
  function download() {
    if (!csvRows) return;
    // BOM supaya Excel membaca UTF-8 dengan benar.
    const blob = new Blob(['﻿', toCsv(csvRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 print:hidden">
      {csvRows && (
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="h-4 w-4" aria-hidden />
          Unduh CSV
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden />
        Cetak atau simpan PDF
      </Button>
    </div>
  );
}
