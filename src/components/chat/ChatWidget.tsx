'use client';

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, LoaderCircle, MessageCircle, SendHorizontal, UserRound, X } from 'lucide-react';
import {
  loadWidgetChatAction,
  requestStaffAction,
  sendWidgetMessageAction,
  widgetUnreadCountAction,
  type WidgetChatState,
  type WidgetMessage,
} from '@/actions/chat.actions';
import { Alert } from '@/components/arc/alert/alert';
import { Textarea } from '@/components/arc/textarea/textarea';
import { OPEN_CHAT_EVENT } from '@/components/chat/events';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';

const OPEN_POLL_MS = 5_000;
const CLOSED_POLL_MS = 30_000;

/**
 * Tautan internal di jawaban bot dibuat bisa diklik, baik format markdown
 * `[teks](/products/slug)` maupun path polos `/products/slug`. Tautan ke luar toko
 * tidak dijadikan link. Tanda tebal `**teks**` dibuang.
 */
const LINK_PATTERN = /\[([^\]\n]{1,60})\]\((\/(?:products|orders)\/[A-Za-z0-9-]+)\)|(\/(?:products|orders)\/[A-Za-z0-9-]+)/g;

function MessageBody({ text }: { text: string }) {
  const clean = text.replace(/\*\*(.+?)\*\*/g, '$1');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of clean.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(<Fragment key={`t${last}`}>{clean.slice(last, index)}</Fragment>);
    const href = match[2] ?? match[3];
    const label = match[1] ?? (href.startsWith('/orders') ? 'Lihat pesanan' : 'Lihat sepatu');
    nodes.push(
      <Link key={`l${index}`} href={href} className="font-semibold underline underline-offset-2">
        {label}
      </Link>,
    );
    last = index + match[0].length;
  }
  if (last < clean.length) nodes.push(<Fragment key={`t${last}`}>{clean.slice(last)}</Fragment>);
  return <>{nodes}</>;
}

function authorLabel(message: WidgetMessage): string {
  if (message.author === 'bot') return 'Asisten otomatis';
  if (message.author === 'staff') return `${message.senderName ?? 'Staf'} · Toko`;
  return 'Kamu';
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

type Props = {
  guest: boolean;
  /** Pesan toko yang belum dibaca saat halaman dirender di server. */
  initialUnread?: number;
};

export function ChatWidget({ guest, initialUnread = 0 }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<WidgetChatState | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [draft, setDraft] = useState('');
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const viewingSlug = pathname.match(/^\/products\/([a-z0-9-]+)$/)?.[1];
  const hidden = pathname.startsWith('/chat');

  const refresh = useCallback(async () => {
    if (guest) return;
    const next = await loadWidgetChatAction();
    setState(next);
    setUnread(0);
  }, [guest]);

  // Saat terbuka: muat isi chat langsung lalu berkala. Saat tertutup: cek pesan baru
  // sesekali, tanpa memanggil action saat halaman baru dibuka. Server action dari satu
  // tab berjalan antre, jadi panggilan di awal bisa menahan klik pertama pembeli.
  useEffect(() => {
    if (guest || hidden) return;
    const tick = () => {
      if (document.visibilityState !== 'visible' || isPending) return;
      if (open) void refresh();
      else void widgetUnreadCountAction().then(setUnread);
    };
    if (open) tick();
    const timer = window.setInterval(tick, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    return () => window.clearInterval(timer);
  }, [guest, hidden, open, refresh, isPending]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, handler);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const messageCount = state?.status === 'ok' ? state.messages.length : 0;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messageCount, pendingBody, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  function send() {
    const body = draft.trim();
    if (!body || isPending) return;
    setError(null);
    setPendingBody(body);
    setDraft('');
    startTransition(async () => {
      const result = await sendWidgetMessageAction({ body, viewingSlug });
      if (result.success) setState(result.state);
      else {
        setError(result.message);
        setDraft(body);
      }
      setPendingBody(null);
    });
  }

  function askStaff() {
    setError(null);
    startTransition(async () => {
      const result = await requestStaffAction();
      if (result.success) setState(result.state);
      else setError(result.message);
    });
  }

  const ready = state?.status === 'ok' ? state : null;
  const statusLine = guest
    ? 'Masuk dulu untuk mulai chat'
    : !ready
      ? 'Memuat…'
      : ready.needsStaff || !ready.botActive
        ? 'Staf toko akan membalas di jam kerja'
        : 'Dijawab asisten otomatis · bisa minta staf';

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Chat dengan toko"
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[min(36rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border border-studio-line bg-white shadow-[0_12px_40px_rgba(17,17,17,0.18)] sm:inset-x-auto sm:right-6 sm:w-[23rem]"
        >
          <header className="flex items-start gap-3 bg-ink px-4 py-3.5 text-white">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Chat Toko</h2>
              <p className="truncate text-xs text-white/70">{statusLine}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Tutup chat" className="-mr-1 !px-1.5 !text-white">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </header>

          {guest ? (
            <div className="space-y-4 px-5 py-8 text-center">
              <p className="text-sm text-ink">Tanya stok, ukuran, ongkir, atau status pesanan. Masuk dulu supaya kami bisa membalas.</p>
              <ButtonLink href="/login" variant="primary" pill>
                Masuk untuk Chat
              </ButtonLink>
            </div>
          ) : (
            <>
              <ol ref={listRef} className="flex min-h-56 flex-1 flex-col gap-3 overflow-y-auto bg-[#FAFAFA] p-4" aria-live="polite" aria-label="Isi percakapan">
                {ready && ready.messages.length === 0 && !pendingBody && (
                  <li className="m-auto max-w-[16rem] text-center text-sm text-ink-muted">
                    Halo! Mau tanya stok, ukuran yang pas, ongkir, atau status pesanan? Tulis aja di bawah.
                  </li>
                )}
                {ready?.messages.map((message) => {
                  const mine = message.author === 'customer';
                  return (
                    <li key={message.id} className={`max-w-[85%] ${mine ? 'self-end' : 'self-start'}`}>
                      {!mine && (
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                          {message.author === 'bot' ? <Bot className="h-3 w-3" aria-hidden /> : <UserRound className="h-3 w-3" aria-hidden />}
                          {authorLabel(message)}
                        </p>
                      )}
                      <p
                        className={`whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm ${
                          mine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-studio-line bg-white text-ink'
                        }`}
                      >
                        <MessageBody text={message.body} />
                      </p>
                      <p className={`mt-0.5 text-[11px] text-ink-muted ${mine ? 'text-right' : ''}`}>
                        <span className="sr-only">{authorLabel(message)}, </span>
                        {timeOf(message.createdAt)}
                      </p>
                    </li>
                  );
                })}
                {pendingBody && (
                  <>
                    <li className="max-w-[85%] self-end">
                      <p className="whitespace-pre-line break-words rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm text-white opacity-70">
                        {pendingBody}
                      </p>
                    </li>
                    {ready?.botActive && (
                      <li className="flex items-center gap-1.5 self-start text-xs text-ink-muted">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Asisten sedang mengetik…
                      </li>
                    )}
                  </>
                )}
              </ol>

              <div className="border-t border-studio-line bg-white p-3">
                {error && <Alert tone="danger" title={error} className="mb-2" />}
                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <Textarea
                      id="widget-message"
                      label="Pesan"
                      hideLabel
                      ref={inputRef}
                      rows={1}
                      maxLength={1000}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          // Enter yang mengonfirmasi ketikan IME (Jepang, Cina, Korea) bukan perintah kirim.
                          // keyCode 229 menangkap Safari yang mereset isComposing terlalu cepat.
                          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                          send();
                        }
                      }}
                      placeholder="Tulis pesan…"
                      className="!min-h-10 max-h-28 resize-none"
                    />
                  </div>
                  <Button type="submit" variant="ink" disabled={!draft.trim() || isPending} aria-label="Kirim pesan" className="!px-2.5">
                    <SendHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </form>
                {ready && ready.botActive && !ready.needsStaff && (
                  <Button variant="ghost" size="sm" onClick={askStaff} disabled={isPending} className="mt-2">
                    Bicara dengan staf toko
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <Button
        variant="ink"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Tutup chat toko' : unread > 0 ? `Buka chat toko, ${unread} pesan baru` : 'Buka chat toko'}
        aria-expanded={open}
        className="!fixed bottom-5 right-4 z-50 !h-14 !w-14 !px-0 shadow-lg"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
        {!open && unread > 0 && (
          <span className="tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-promo px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
    </>
  );
}
