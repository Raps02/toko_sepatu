'use client';

import Link from 'next/link';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
import { Badge, type Tone } from '@/components/dashboard/PageHeader';
import { formatRupiah } from '@/lib/format';

export type RecentOrderRow = {
  id: string;
  orderNumber: string;
  buyer: string;
  /** Untuk diurutkan: milidetik sejak epoch. */
  createdAt: number;
  createdLabel: string;
  statusLabel: string;
  statusTone: Tone;
  total: number;
};

export function RecentOrdersTable({ rows }: { rows: RecentOrderRow[] }) {
  return (
    <SortableDataTable
      rows={rows}
      rowKey="id"
      caption="Order terbaru"
      emptyMessage="Belum ada order masuk"
      itemName={{ one: 'order', other: 'order' }}
      defaultSort={{ key: 'createdAt', direction: 'desc' }}
      columns={[
        {
          key: 'orderNumber',
          label: 'Order',
          render: (_, row) => (
            <Link href={`/dashboard/orders/${row.id}`} className="tabular font-medium text-ink underline-offset-4 hover:underline">
              {row.orderNumber}
            </Link>
          ),
        },
        { key: 'buyer', label: 'Pembeli', sortable: true },
        { key: 'createdAt', label: 'Masuk', sortable: true, numeric: false, render: (_, row) => row.createdLabel },
        { key: 'statusLabel', label: 'Status', sortable: true, render: (_, row) => <Badge tone={row.statusTone}>{row.statusLabel}</Badge> },
        { key: 'total', label: 'Total', numeric: true, sortable: true, render: (_, row) => formatRupiah(row.total) },
      ]}
    />
  );
}
