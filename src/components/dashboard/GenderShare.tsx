'use client';

import { DonutChart, type DonutChartDatum } from '@/components/arc/donut-chart/donut-chart';
import { Panel } from '@/components/dashboard/Panel';

/** Pembagian pasang terjual menurut peruntukan sepatu (Pria, Wanita, Unisex). */
export function GenderShare({ data }: { data: DonutChartDatum[] }) {
  return (
    <Panel title="Untuk siapa" description="Pasang terjual, 30 hari terakhir" className="h-full">
      <DonutChart
          data={data}
          label="Pasang terjual menurut peruntukan"
          unit="pasang"
          totalLabel="Pasang"
          size={168}
          thickness={20}
          emptyLabel="Belum ada pasang terjual"
          className="w-full"
        />
    </Panel>
  );
}
