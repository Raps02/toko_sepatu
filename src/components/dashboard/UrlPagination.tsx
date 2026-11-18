'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/arc/pagination/pagination';

/** Pagination Arc yang menyimpan halaman di parameter `page`; filter lain di URL tetap ikut. */
export function UrlPagination({ page, pageCount, label, hash = '' }: { page: number; pageCount: number; label: string; hash?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <Pagination
      label={label}
      page={page}
      pageCount={pageCount}
      onPageChange={(next) => {
        const query = new URLSearchParams(params);
        if (next > 1) query.set('page', String(next));
        else query.delete('page');
        const text = query.toString();
        router.push(`${pathname}${text ? `?${text}` : ''}${hash}`);
      }}
    />
  );
}
