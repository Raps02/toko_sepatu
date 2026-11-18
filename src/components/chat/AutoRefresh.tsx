'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Memuat ulang data halaman secara berkala selama tab sedang dilihat. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return null;
}
