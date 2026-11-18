import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState } from '@/components/dashboard/PageHeader';
import { Panel, panelListClass } from '@/components/dashboard/Panel';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { unreadByCustomer } from '@/lib/chat';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chat' };

export default async function ChatListPage() {
  const user = await requirePagePermission('chat.start');

  const conversations = await prisma.conversation.findMany({
    where: { customerId: user.id },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      product: { select: { name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true } },
      _count: { select: { messages: { where: unreadByCustomer } } },
    },
  });

  if (conversations.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="sr-only">Chat toko</h1>
        <EmptyState
          title="Belum Ada Percakapan"
          hint="Tekan tombol chat di pojok kanan bawah untuk bertanya soal stok, ukuran, ongkir, atau pesanan."
          action={
            <ButtonLink href="/products" variant="primary" pill>
              Lihat Semua Sepatu
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Chat Toko</h1>
      <div className="mt-6">
      <Panel title="Percakapan">
      <ul className={panelListClass}>
        {conversations.map((conversation) => (
          <li key={conversation.id} className="relative px-5 py-4 transition-colors hover:bg-studio">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/chat/${conversation.id}`} className="font-semibold after:absolute after:inset-0">
                {conversation.product ? conversation.product.name : 'Chat Toko'}
              </Link>
              {conversation._count.messages > 0 && <Badge tone="warn">{conversation._count.messages} baru</Badge>}
            </div>
            <p className="truncate text-sm text-ink-muted">{conversation.messages[0]?.body ?? 'Belum ada pesan'}</p>
            <p className="text-xs text-ink-muted">{formatDateTime(conversation.lastMessageAt)}</p>
          </li>
        ))}
      </ul>
      </Panel>
      </div>
    </div>
  );
}
