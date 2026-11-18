import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChatThread } from '@/components/chat/ChatThread';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chat produk' };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('chat.start');
  const { id } = await params;

  // `customerId` di where: pembeli hanya bisa membuka percakapannya sendiri.
  const conversation = await prisma.conversation.findFirst({
    where: { id, customerId: user.id },
    include: { product: { select: { name: true, slug: true } } },
  });
  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <ButtonLink href="/chat" variant="ghost" size="sm">
        Semua percakapan
      </ButtonLink>
      <h1 className="mt-2 font-display text-3xl font-bold">
        {conversation.product ? (
          <>
            Tanya soal{' '}
            <Link href={`/products/${conversation.product.slug}`} className="underline decoration-marking decoration-4 underline-offset-4">
              {conversation.product.name}
            </Link>
          </>
        ) : (
          'Chat Toko'
        )}
      </h1>
      <div className="mt-5">
        <ChatThread conversationId={conversation.id} viewerId={user.id} side="customer" />
      </div>
    </div>
  );
}
