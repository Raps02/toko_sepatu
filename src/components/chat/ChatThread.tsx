import { sendMessageAction } from '@/actions/service.actions';
import { AutoRefresh } from '@/components/chat/AutoRefresh';
import { Panel } from '@/components/dashboard/Panel';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { TextAreaField } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { messageAuthor, unreadByCustomer, unreadByStaff } from '@/lib/chat';
import { prisma } from '@/lib/prisma';

type Props = {
  conversationId: string;
  viewerId: string;
  /** Sisi yang sedang melihat: menentukan pesan siapa yang ditandai sudah dibaca. */
  side: 'customer' | 'staff';
};

/** Isi percakapan + kotak balas. Dipakai halaman chat pembeli dan dashboard. */
export async function ChatThread({ conversationId, viewerId, side }: Props) {
  // Pesan dari pihak seberang ditandai terbaca begitu percakapan dibuka.
  await prisma.message.updateMany({
    where: { conversationId, ...(side === 'customer' ? unreadByCustomer : unreadByStaff) },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return (
    <Panel title="Percakapan">
      <AutoRefresh seconds={5} />

      <ol className="flex max-h-[60vh] min-h-48 flex-col gap-3 overflow-y-auto" aria-label="Isi percakapan">
        {messages.length === 0 && (
          <li className="m-auto text-center text-sm text-ink-muted">
            {side === 'customer' ? 'Tulis pertanyaanmu. Toko biasanya membalas di jam kerja.' : 'Belum ada pesan di percakapan ini.'}
          </li>
        )}
        {messages.map((message) => {
          const author = messageAuthor(message);
          const fromStore = author !== 'customer';
          // Di dashboard, balasan bot ditampilkan di sisi toko tapi diberi label bot.
          const mine = side === 'staff' ? fromStore : !fromStore;
          return (
            <li key={message.id} className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
              <p
                className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                  author === 'bot' ? 'border border-studio-line bg-white text-ink' : mine ? 'bg-ink text-white' : 'bg-studio text-ink'
                }`}
              >
                {message.body}
              </p>
              <p className={`mt-1 text-xs text-ink-muted ${mine ? 'text-right' : ''}`}>
                {author === 'bot'
                  ? 'Asisten otomatis'
                  : message.sender?.id === viewerId
                    ? 'Kamu'
                    : author === 'staff'
                      ? `${message.sender?.name} (toko)`
                      : message.sender?.name},{' '}
                {formatDateTime(message.createdAt)}
              </p>
            </li>
          );
        })}
      </ol>

      <ActionForm
        action={sendMessageAction.bind(null, conversationId)}
        resetOnSuccess
        showSuccess={false}
        className="mt-4 border-t border-studio-line pt-4"
      >
        <div className="flex items-end gap-2">
          <TextAreaField id="body" label="Pesan" hideLabel name="body" rows={2} maxLength={1000} required placeholder="Tulis pesan" wrapperClassName="min-w-0 flex-1" />
          <SubmitButton pendingLabel="Mengirim…">Kirim</SubmitButton>
        </div>
      </ActionForm>
    </Panel>
  );
}
