'use client';

import type { ReactNode } from 'react';
import { SortableDataTable, type SortState } from '@/components/arc/sortable-data-table/sortable-data-table';

export type TableColumn = { key: string; label: string; numeric?: boolean; width?: number | string };
export type TableRow = {
  id: string;
  /** Isi tiap kolom. Boleh berisi komponen server, karena fungsi render tidak bisa dikirim dari server. */
  cells: Record<string, ReactNode>;
  /** Nilai untuk mengurutkan. Kolom tanpa nilai di sini tidak bisa diurutkan. */
  sort?: Record<string, string | number>;
};

type Row = Record<string, unknown> & { __id: string; __cells: Record<string, ReactNode> };

/** Tabel dashboard di atas SortableDataTable Arc, bisa dipakai langsung dari halaman server. */
export function DataTable({
  caption,
  columns,
  rows,
  emptyMessage,
  defaultSort,
}: {
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
  emptyMessage?: string;
  defaultSort?: SortState;
}) {
  const data: Row[] = rows.map((row) => ({ ...row.sort, __id: row.id, __cells: row.cells }));
  return (
    <SortableDataTable<Row>
      caption={caption}
      rows={data}
      rowKey={(row) => row.__id}
      emptyMessage={emptyMessage}
      defaultSort={defaultSort}
      columns={columns.map((column) => ({
        key: column.key,
        label: column.label,
        width: column.width,
        numeric: column.numeric ?? false,
        sortable: rows.some((row) => row.sort?.[column.key] !== undefined),
        render: (_, row) => row.__cells[column.key],
      }))}
    />
  );
}
