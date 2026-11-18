import { after } from 'next/server';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { SiteFooter, SiteHeader } from '@/components/shop/SiteHeader';
import { unreadByCustomer } from '@/lib/chat';
import { releaseExpiredStock } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Stok dari order yang tidak dibayar kembali tanpa menunggu staf membuka daftar order.
  after(releaseExpiredStock);
  // Staf membalas dari dashboard, jadi tombol chat hanya untuk pengunjung dan pembeli.
  const showChat = !user || can(user.role, 'chat.start');
  const unread =
    user && showChat ? await prisma.message.count({ where: { conversation: { customerId: user.id }, ...unreadByCustomer } }) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {showChat && <ChatWidget guest={!user} initialUnread={unread} />}
    </div>
  );
}
