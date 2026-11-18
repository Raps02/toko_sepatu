'use client';

import { Alert } from '@/components/arc/alert/alert';
import { useState, useTransition } from 'react';
import { Eye, FileDown } from 'lucide-react';
import { downloadInvoiceAction } from '@/actions/order.actions';
import { Button } from '@/components/ui/Button';

type Mode = 'view' | 'download';

/** Tombol lihat (tab baru) dan unduh invoice PDF untuk pesanan yang sudah dibayar. */
export function InvoiceDownloadButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(next: Mode) {
    setError(null);
    setMode(next);
    // Tab dibuka langsung saat diklik; kalau dibuka sesudah menunggu server, browser menganggapnya pop-up dan memblokirnya.
    const tab = next === 'view' ? window.open('', '_blank') : null;

    startTransition(async () => {
      const result = await downloadInvoiceAction(orderId);
      if (!result.success) {
        tab?.close();
        setError(result.message);
        return;
      }

      const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));

      if (tab) {
        tab.opener = null;
        tab.location.href = url;
        // Tab baru butuh waktu memuat PDF dari URL ini, jadi jangan langsung dicabut.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      // Unduh, atau cadangan kalau tab baru diblokir browser.
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ink" size="sm" onClick={() => open('view')} loading={pending && mode === 'view'} disabled={pending && mode !== 'view'}>
          <Eye className="h-4 w-4" aria-hidden />
          Lihat invoice
        </Button>
        <Button
          variant="pillSecondary"
          size="sm"
          onClick={() => open('download')}
          loading={pending && mode === 'download'}
          disabled={pending && mode !== 'download'}
        >
          <FileDown className="h-4 w-4" aria-hidden />
          {pending && mode === 'download' ? 'Menyiapkan invoice…' : 'Unduh invoice (PDF)'}
        </Button>
      </div>
      {error && <Alert tone="danger" title={error} className="mt-2" />}
    </div>
  );
}
