'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArcProvider, type ArcLinkComponent } from '@/components/arc/lib/arc-provider';

/** Tautan di dalam komponen Arc memakai Link Next, supaya pindah halaman tidak memuat ulang. */
export function ArcLinks({ children }: { children: ReactNode }) {
  return <ArcProvider link={Link as ArcLinkComponent}>{children}</ArcProvider>;
}
