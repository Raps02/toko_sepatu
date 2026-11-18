import type { ReactNode } from 'react';
import { Accordion } from '@/components/arc/accordion/accordion';

/** Bagian yang bisa dibuka-tutup, di atas Accordion Arc. */
export function Disclosure({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return <Accordion items={[{ title, content: children }]} defaultOpen={defaultOpen ? 0 : -1} />;
}
