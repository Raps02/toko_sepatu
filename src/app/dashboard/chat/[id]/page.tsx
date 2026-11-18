import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { setBotEnabledAction } from '@/actions/chat.actions';
import { ChatThread } from '@/components/chat/ChatThread';
import { Badge, PageHeader } from '@/components/dashboard/PageHeader';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { botConfig } from '@/lib/chatbot';
import { prisma } from '@/lib/prisma';
import { requirePagePermission } from '@/lib/session';

export const metadata: Metadata = { title: 'Percakapan' };

export default async function DashboardChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('chat.reply');
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true } },
      product: { select: { id: true, name: true, brand: true } },
    },
  });
  if (!conversation) notFound();

  return (
    <div className="max-w-3xl">
      <ButtonLink href="/dashboard/chat" variant="ghost" size="sm" className="mb-3">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Semua percakapan
      </ButtonLink>
      <PageHeader
        title={conversation.customer.name}
        description={`${
          conversation.product ? `Menanyakan ${conversation.product.brand} ${conversation.product.name}` : 'Chat umum'
        }, ${conversation.customer.email}`}
        actions={
          conversation.product && (
            <ButtonLink href={`/dashboard/products/${conversation.product.id}`} variant="secondary" size="sm">
              Lihat stok produk
            </ButtonLink>
          )
        }
      />
      <div className="mb-4">
        <Panel
          title="Penjawab chat"
          aside={conversation.needsStaff ? <Badge tone="warn">Butuh staf</Badge> : undefined}
          description={
            !botConfig()
              ? 'Bot belum aktif, jadi semua chat dibalas staf.'
              : conversation.botEnabled
                ? 'Bot sedang menjawab percakapan ini. Balasan staf akan mematikan bot.'
                : 'Bot diam di percakapan ini. Staf yang membalas.'
          }
        >
          {botConfig() && (
            <ActionForm action={setBotEnabledAction.bind(null, conversation.id, !conversation.botEnabled)}>
              <SubmitButton variant="secondary" size="sm">
                {conversation.botEnabled ? 'Matikan bot' : 'Serahkan ke bot lagi'}
              </SubmitButton>
            </ActionForm>
          )}
        </Panel>
      </div>
      <ChatThread conversationId={conversation.id} viewerId={user.id} side="staff" />
    </div>
  );
}
