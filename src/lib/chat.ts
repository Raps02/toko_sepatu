import type { Prisma } from '@prisma/client';
import { botConfig, generateBotReply, type HistoryMessage } from '@/lib/chatbot';
import { isUniqueViolation } from '@/lib/action-helpers';
import { prisma } from '@/lib/prisma';

/** Balasan bot maksimal per percakapan per jam, supaya kuota API tidak habis oleh satu orang. */
const BOT_REPLIES_PER_HOUR = 30;
/** Balasan bot maksimal per hari untuk seluruh toko. */
const BOT_REPLIES_PER_DAY = 1000;

const BOT_UNAVAILABLE = 'Maaf, asisten otomatis sedang tidak bisa menjawab. Pesanmu sudah diteruskan ke staf toko.';

/** Pesan dari pihak toko (staf atau bot) yang belum dibaca pembeli. */
export const unreadByCustomer = {
  readAt: null,
  OR: [{ isBot: true }, { sender: { role: { not: 'CUSTOMER' } } }],
} satisfies Prisma.MessageWhereInput;

/** Pesan pembeli yang belum dibaca staf. */
export const unreadByStaff = { readAt: null, sender: { role: 'CUSTOMER' } } satisfies Prisma.MessageWhereInput;

/** Siapa pengirim sebuah pesan, untuk tampilan. */
export function messageAuthor(message: { isBot: boolean; sender: { role: string } | null }): 'bot' | 'staff' | 'customer' {
  if (message.isBot || !message.sender) return 'bot';
  return message.sender.role === 'CUSTOMER' ? 'customer' : 'staff';
}

/** Chat umum milik pembeli (dari tombol chat melayang); dibuat kalau belum ada. */
export async function getOrCreateGeneralConversation(customerId: string) {
  const existing = await prisma.conversation.findFirst({ where: { customerId, productId: null } });
  if (existing) return existing;
  try {
    return await prisma.conversation.create({ data: { customerId } });
  } catch (error) {
    // Dua tab membuat bersamaan: index parsial menolak yang kedua, pakai yang sudah ada.
    if (!isUniqueViolation(error)) throw error;
    return prisma.conversation.findFirstOrThrow({ where: { customerId, productId: null } });
  }
}

async function addBotMessage(conversationId: string, body: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, isBot: true, body } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
  ]);
}

async function botQuotaLeft(conversationId: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [perConversation, perDay] = await Promise.all([
    prisma.message.count({ where: { conversationId, isBot: true, createdAt: { gte: hourAgo } } }),
    prisma.message.count({ where: { isBot: true, createdAt: { gte: dayAgo } } }),
  ]);
  return perConversation < BOT_REPLIES_PER_HOUR && perDay < BOT_REPLIES_PER_DAY;
}

/** Tandai percakapan menunggu staf dan matikan bot di dalamnya. */
export async function handOffToStaff(conversationId: string, botMessage?: string) {
  await prisma.conversation.update({ where: { id: conversationId }, data: { needsStaff: true, botEnabled: false } });
  if (botMessage) await addBotMessage(conversationId, botMessage);
}

/**
 * Simpan pesan pembeli, lalu biarkan bot menjawab kalau bot masih aktif di percakapan ini.
 * Pemanggil wajib sudah memastikan percakapan milik `customer`.
 */
export async function postCustomerMessage(input: {
  conversationId: string;
  customer: { id: string; name: string };
  body: string;
  /** Slug produk yang sedang dibuka pembeli (dari widget), untuk konteks bot. */
  viewingSlug?: string;
}) {
  const now = new Date();
  const [, conversation] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: input.conversationId, senderId: input.customer.id, body: input.body } }),
    prisma.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: now },
      include: { product: { select: { name: true, slug: true } } },
    }),
  ]);

  if (!conversation.botEnabled) {
    // Sudah ditangani staf: pastikan muncul sebagai menunggu balasan.
    if (!conversation.needsStaff) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { needsStaff: true } });
    }
    return;
  }

  if (!botConfig()) {
    // Bot belum disetel: langsung ke staf, tanpa pesan bot.
    await prisma.conversation.update({ where: { id: conversation.id }, data: { needsStaff: true } });
    return;
  }

  if (!(await botQuotaLeft(conversation.id))) {
    await handOffToStaff(conversation.id, BOT_UNAVAILABLE);
    return;
  }

  let viewingProduct: string | null = null;
  if (conversation.product) {
    viewingProduct = `${conversation.product.name} (slug: ${conversation.product.slug})`;
  } else if (input.viewingSlug) {
    const product = await prisma.product.findFirst({
      where: { slug: input.viewingSlug, isPublished: true },
      select: { name: true, slug: true },
    });
    if (product) viewingProduct = `${product.name} (slug: ${product.slug})`;
  }

  const recent = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { body: true, isBot: true, sender: { select: { role: true } } },
  });
  const history: HistoryMessage[] = recent.reverse().map((m) => ({ role: messageAuthor(m), body: m.body }));

  const result = await generateBotReply({
    customerId: input.customer.id,
    customerName: input.customer.name,
    viewingProduct,
    history,
  });

  if (result.kind === 'reply') await addBotMessage(conversation.id, result.body);
  else if (result.kind === 'handoff') await handOffToStaff(conversation.id, result.body);
  else await handOffToStaff(conversation.id, BOT_UNAVAILABLE);
}
