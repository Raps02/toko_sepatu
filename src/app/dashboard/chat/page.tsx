import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/chat/AutoRefresh';
import { Badge, EmptyState, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { messageAuthor, unreadByStaff } from '@/lib/chat';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Chat' };

export default async function DashboardChatPage() {
  await requirePagePermission('chat.reply');

  const conversations = await prisma.conversation.findMany({
    // Percakapan tanpa pesan (pembeli baru membuka, belum menulis) tidak ditampilkan.
    where: { messages: { some: {} } },
    // Yang menunggu staf tampil paling atas.
    orderBy: [{ needsStaff: 'desc' }, { lastMessageAt: 'desc' }],
    take: 100,
    include: {
      customer: { select: { name: true } },
      product: { select: { name: true, brand: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, isBot: true, sender: { select: { role: true } } } },
      _count: { select: { messages: { where: unreadByStaff } } },
    },
  });

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader title="Chat pembeli" description="Bot menjawab duluan. Percakapan yang butuh staf tampil paling atas; balasan staf otomatis mematikan bot di percakapan itu." />

      {conversations.length === 0 ? (
        <EmptyState title="Belum ada pertanyaan dari pembeli." hint="Percakapan muncul begitu pembeli mengirim pesan lewat tombol chat." />
      ) : (
        <Panel title="Percakapan">
        <ul className={panelListClass}>
          {conversations.map((conversation) => {
            const last = conversation.messages[0];
            const unread = conversation._count.messages;
            const lastAuthor = last ? messageAuthor(last) : null;
            const waiting = conversation.needsStaff || (lastAuthor === 'customer' && !conversation.botEnabled);
            return (
              <li key={conversation.id} className="relative px-5 py-4 transition-colors hover:bg-pavement/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/chat/${conversation.id}`} className="font-medium text-ink after:absolute after:inset-0">
                    {conversation.customer.name}
                  </Link>
                  <span className="flex gap-1.5">
                    {conversation.needsStaff && <Badge tone="warn">Butuh staf</Badge>}
                    {unread > 0 ? <Badge tone="warn">{unread} belum dibaca</Badge> : waiting ? <Badge>Belum dibalas</Badge> : null}
                    {!conversation.needsStaff && conversation.botEnabled && <Badge>Ditangani bot</Badge>}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {conversation.product ? `${conversation.product.brand} ${conversation.product.name}` : 'Chat umum'},{' '}
                  {formatDateTime(conversation.lastMessageAt)}
                </p>
                <p className="mt-1.5 truncate text-sm text-ink">
                  {lastAuthor === 'bot' && <span className="font-medium text-ink-muted">Bot: </span>}
                  {lastAuthor === 'staff' && <span className="font-medium text-ink-muted">Toko: </span>}
                  {last?.body}
                </p>
              </li>
            );
          })}
        </ul>
        </Panel>
      )}
    </>
  );
}
