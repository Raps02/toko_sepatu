import type { OrderStatus } from '@prisma/client';
import { Stepper } from '@/components/arc/stepper/stepper';
import { formatDateTime } from '@/lib/format';

type ProgressOrder = {
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  processedAt: Date | null;
  shippedAt: Date | null;
  completedAt: Date | null;
};

// Langkah yang sedang berjalan. Pesanan selesai memakai panjang daftar: semua langkah tuntas.
const STEP_OF: Partial<Record<OrderStatus, number>> = {
  PENDING_PAYMENT: 1,
  PAID: 2,
  PROCESSING: 3,
  SHIPPED: 4,
  COMPLETED: 5,
};

/** Progres pesanan di atas Stepper Arc. Pesanan batal atau kedaluwarsa tidak punya progres. */
export function OrderProgress({ order }: { order: ProgressOrder }) {
  const current = STEP_OF[order.status];
  if (current === undefined) return null;

  const steps: { id: string; label: string; at: Date | null }[] = [
    { id: 'dibuat', label: 'Dibuat', at: order.createdAt },
    { id: 'dibayar', label: 'Dibayar', at: order.paidAt },
    { id: 'disiapkan', label: 'Disiapkan', at: order.processedAt },
    { id: 'dikirim', label: 'Dikirim', at: order.shippedAt },
    { id: 'diterima', label: 'Diterima', at: order.completedAt },
  ];

  return (
    <Stepper
      label="Progres pesanan"
      completeLabel="Pesanan selesai"
      current={current}
      steps={steps.map(({ id, label, at }) => ({ id, label, description: at ? formatDateTime(at) : undefined }))}
    />
  );
}
