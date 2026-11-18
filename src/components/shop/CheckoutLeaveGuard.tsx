'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Ringkasan isi pesanan, mis. "Senja Flat × 2". */
  summary: string;
  /** Checkout dari "Beli Sekarang": isi keranjang tidak ikut. */
  buyNow: boolean;
};

/**
 * Saat pembeli di checkout mengeklik link ke halaman lain, tampilkan konfirmasi dulu:
 * lanjut bayar atau lihat yang lain. Hanya link di dalam toko yang dicegat; menutup
 * tab, tombol back, dan redirect ke halaman pembayaran tidak ikut ditahan.
 */
export function CheckoutLeaveGuard({ summary, buyNow }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (submittingRef.current || event.defaultPrevented) return;
      // Biarkan klik dengan modifier (buka di tab baru) dan klik selain tombol kiri.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      // Dicegat sebelum handler <Link> milik Next.js berjalan.
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    }

    function onSubmit() {
      // Pesanan sedang dibuat: jangan tahan navigasi sesudahnya.
      submittingRef.current = true;
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  function stay() {
    setTarget(null);
    // Arahkan ke tombol pesan supaya pembeli bisa langsung lanjut.
    document.querySelector<HTMLElement>('form button[type="submit"]:not([disabled])')?.focus();
  }

  function leave() {
    const href = target;
    setTarget(null);
    if (href) router.push(href);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="leave-checkout-title"
      aria-describedby="leave-checkout-desc"
      onCancel={(event) => {
        event.preventDefault();
        stay();
      }}
      onClick={(event) => {
        // Klik di luar kartu = tetap di checkout.
        if (event.target === event.currentTarget) stay();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-[0_20px_60px_rgba(17,17,17,0.25)] backdrop:bg-ink/50"
    >
      <div className="p-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-studio" aria-hidden>
          <ShoppingBag className="h-5 w-5" />
        </span>
        <h2 id="leave-checkout-title" className="mt-4 text-xl font-bold tracking-tight">
          Pesananmu belum dibuat
        </h2>
        <div id="leave-checkout-desc" className="mt-2 space-y-2 text-sm text-ink-muted">
          <p>
            <span className="font-semibold text-ink">{summary}</span> belum dipesan, jadi stoknya belum disimpan untukmu.
          </p>
          <p>{buyNow ? 'Kalau pergi sekarang, kamu perlu memilih sepatunya lagi nanti.' : 'Isi keranjangmu tetap tersimpan kalau kamu pergi.'}</p>
        </div>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <Button variant="pillSecondary" onClick={leave}>
            Lihat yang lain
          </Button>
          <Button variant="ink" autoFocus onClick={stay}>
            Lanjut bayar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
