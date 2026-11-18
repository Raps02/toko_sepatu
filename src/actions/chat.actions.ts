'use server';

// Chat dari tombol melayang (widget) dan kontrol bot dari dashboard.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { failFrom, ok } from '@/lib/action-helpers';
import { getOrCreateGeneralConversation, handOffToStaff, messageAuthor, postCustomerMessage, unreadByCustomer } from '@/lib/chat';
import { botConfig } from '@/lib/chatbot';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requirePermission } from '@/lib/session';
import { messageSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

export type WidgetMessage = {
  id: string;
  author: 'customer' | 'staff' | 'bot';
  senderName: string | null;
  body: string;
  createdAt: string;
};

export type WidgetChatState =
  | { status: 'guest' }
  | { status: 'staff' }
  | {
      status: 'ok';
      messages: WidgetMessage[];
      /** Bot akan menjawab pesan berikutnya. */
      botActive: boolean;
      needsStaff: boolean;
    };

const widgetSendSchema = z.object({
  body: messageSchema.shape.body,
  viewingSlug: z.preprocess(
    (v) => (typeof v === 'string' && /^[a-z0-9-]{1,160}$/.test(v) ? v : undefined),
    z.string().optional(),
  ),
});

async function widgetState(conversationId: string): Promise<WidgetChatState> {
  // Dibuka di widget = pesan dari toko dianggap sudah dibaca.
  await prisma.message.updateMany({ where: { conversationId, ...unreadByCustomer }, data: { readAt: new Date() } });

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { sender: { select: { name: true, role: true } } },
      },
    },
  });

  return {
    status: 'ok',
    botActive: conversation.botEnabled && botConfig() !== null,
    needsStaff: conversation.needsStaff,
    messages: conversation.messages.reverse().map((m) => ({
      id: m.id,
      author: messageAuthor(m),
      senderName: m.sender?.name ?? null,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Isi chat umum pembeli untuk widget. Tidak membuat percakapan baru kalau belum ada pesan. */
export async function loadWidgetChatAction(): Promise<WidgetChatState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'guest' };
  if (!can(user.role, 'chat.start')) return { status: 'staff' };

  const conversation = await prisma.conversation.findFirst({ where: { customerId: user.id, productId: null } });
  if (!conversation) return { status: 'ok', messages: [], botActive: botConfig() !== null, needsStaff: false };
  return widgetState(conversation.id);
}

/** Jumlah pesan toko yang belum dibaca di semua chat pembeli, untuk badge di tombol melayang. */
export async function widgetUnreadCountAction(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, 'chat.start')) return 0;
  return prisma.message.count({ where: { conversation: { customerId: user.id }, ...unreadByCustomer } });
}

export async function sendWidgetMessageAction(
  input: { body: string; viewingSlug?: string },
): Promise<{ success: true; state: WidgetChatState } | { success: false; message: string }> {
  const { user, denied } = await requirePermission('chat.start');
  if (denied) return { success: false, message: denied.message ?? 'Akun kamu tidak bisa mengirim chat.' };

  const parsed = widgetSendSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Pesan tidak valid.' };

  try {
    const conversation = await getOrCreateGeneralConversation(user.id);
    await postCustomerMessage({
      conversationId: conversation.id,
      customer: { id: user.id, name: user.name },
      body: parsed.data.body,
      viewingSlug: parsed.data.viewingSlug,
    });
    revalidatePath('/dashboard', 'layout');
    return { success: true, state: await widgetState(conversation.id) };
  } catch (error) {
    const response = failFrom(error, 'Pesan belum terkirim. Coba kirim lagi.');
    return { success: false, message: response.message ?? 'Pesan belum terkirim.' };
  }
}

/** Pembeli minta dibalas staf manusia. */
export async function requestStaffAction(): Promise<{ success: true; state: WidgetChatState } | { success: false; message: string }> {
  const { user, denied } = await requirePermission('chat.start');
  if (denied) return { success: false, message: denied.message ?? 'Akun kamu tidak bisa mengirim chat.' };

  const conversation = await getOrCreateGeneralConversation(user.id);
  if (!conversation.needsStaff) {
    await handOffToStaff(conversation.id, 'Siap, staf toko sudah diberi tahu dan akan membalas di chat ini secepatnya (biasanya di jam kerja).');
  }
  revalidatePath('/dashboard', 'layout');
  return { success: true, state: await widgetState(conversation.id) };
}

/** Staf menyalakan/mematikan bot di satu percakapan. */
export async function setBotEnabledAction(conversationId: string, enabled: boolean): Promise<ActionResponse> {
  const { denied } = await requirePermission('chat.reply');
  if (denied) return denied;

  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      // Bot dinyalakan lagi = urusan staf dianggap selesai.
      data: enabled ? { botEnabled: true, needsStaff: false } : { botEnabled: false },
    });
  } catch (error) {
    return failFrom(error, 'Status bot belum bisa diubah.');
  }

  revalidatePath(`/dashboard/chat/${conversationId}`);
  revalidatePath('/dashboard', 'layout');
  return ok(enabled ? 'Bot aktif lagi di percakapan ini.' : 'Bot dimatikan di percakapan ini.');
}

