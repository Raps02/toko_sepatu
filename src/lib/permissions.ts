// Satu-satunya sumber kebenaran hak akses. Dipakai oleh middleware, menu
// dashboard, halaman, dan setiap server action. File ini sengaja tidak
// mengimpor apa pun supaya aman dipakai di edge runtime dan unit test.

export type Role = 'ADMIN' | 'SPV' | 'CUSTOMER';

export const PERMISSIONS = {
  // Dashboard
  'dashboard.access': ['ADMIN', 'SPV'],

  // Akun
  'user.manage': ['ADMIN'],

  // Laporan
  'report.finance.daily': ['ADMIN', 'SPV'],
  'report.finance.range': ['ADMIN'],
  'report.rating': ['ADMIN'],

  // Katalog: SPV mengelola isi produk; menayangkan dan menghapus permanen hanya admin.
  'product.manage': ['ADMIN', 'SPV'],
  'product.publish': ['ADMIN'],
  'product.delete': ['ADMIN'],

  // Harga & diskon: admin langsung berlaku, SPV mengajukan
  'price.apply': ['ADMIN'],
  'price.request': ['SPV'],
  'discount.apply': ['ADMIN'],
  'discount.request': ['SPV'],

  // Stok: barang masuk/keluar boleh keduanya, koreksi SPV butuh persetujuan
  'stock.manage': ['ADMIN', 'SPV'],
  'stock.correct.apply': ['ADMIN'],
  'stock.correct.request': ['SPV'],
  // Harga modal (di form produk, daftar produk, dan laporan) hanya untuk admin.
  'cost.view': ['ADMIN'],

  // Order
  'order.process': ['ADMIN', 'SPV'],
  'order.correct.apply': ['ADMIN'],
  'order.correct.request': ['SPV'],

  // Persetujuan & riwayat
  'approval.review': ['ADMIN'],
  'approval.request': ['SPV'],
  'audit.view': ['ADMIN'],

  // Layanan pelanggan
  'return.handle': ['ADMIN', 'SPV'],
  // Menandai dana retur sudah dikembalikan menyangkut uang keluar, jadi hanya admin.
  'return.refund': ['ADMIN'],
  'review.reply': ['ADMIN', 'SPV'],
  'review.moderate': ['ADMIN'],
  'chat.reply': ['ADMIN', 'SPV'],
  'shipping.manage': ['ADMIN'],

  // Customer
  'shop.buy': ['CUSTOMER'],
  'review.write': ['CUSTOMER'],
  'chat.start': ['CUSTOMER'],
  'return.request': ['CUSTOMER'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Halaman awal setelah login, sesuai role. */
export function homePathFor(role: Role): string {
  return can(role, 'dashboard.access') ? '/dashboard' : '/';
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  SPV: 'Supervisor',
  CUSTOMER: 'Customer',
};
