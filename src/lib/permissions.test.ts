import { describe, expect, it } from 'vitest';
import { can, homePathFor, PERMISSIONS, type Permission, type Role } from '@/lib/permissions';

const allowed = (role: Role) => (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));

describe('hak akses per role', () => {
  it('tamu (belum login) tidak punya izin apa pun', () => {
    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });

  it('customer hanya bisa belanja, review, chat, dan retur', () => {
    expect(allowed('CUSTOMER').sort()).toEqual(['chat.start', 'return.request', 'review.write', 'shop.buy']);
  });

  it('SPV mengajukan perubahan harga, diskon, dan koreksi; tidak bisa menerapkannya sendiri', () => {
    for (const permission of ['price.request', 'discount.request', 'stock.correct.request', 'order.correct.request'] as const) {
      expect(can('SPV', permission)).toBe(true);
    }
    for (const permission of ['price.apply', 'discount.apply', 'stock.correct.apply', 'order.correct.apply', 'approval.review'] as const) {
      expect(can('SPV', permission)).toBe(false);
    }
  });

  it('hanya admin yang melihat harga modal, menayangkan, dan menghapus produk', () => {
    for (const permission of ['cost.view', 'product.publish', 'product.delete'] as const) {
      expect(can('ADMIN', permission)).toBe(true);
      expect(can('SPV', permission)).toBe(false);
    }
  });

  it('SPV hanya melihat laporan keuangan harian', () => {
    expect(can('SPV', 'report.finance.daily')).toBe(true);
    expect(can('SPV', 'report.finance.range')).toBe(false);
  });

  it('SPV tidak bisa mengelola akun, ongkir, refund, moderasi review, atau melihat riwayat perubahan', () => {
    for (const permission of ['user.manage', 'shipping.manage', 'return.refund', 'review.moderate', 'audit.view', 'report.rating'] as const) {
      expect(can('SPV', permission)).toBe(false);
    }
  });

  it('SPV menangani pekerjaan harian toko', () => {
    for (const permission of ['product.manage', 'stock.manage', 'order.process', 'return.handle', 'review.reply', 'chat.reply'] as const) {
      expect(can('SPV', permission)).toBe(true);
    }
  });

  it('admin menerapkan langsung dan menyetujui pengajuan, bukan mengajukan', () => {
    for (const permission of ['price.apply', 'discount.apply', 'stock.correct.apply', 'approval.review', 'user.manage', 'report.finance.range'] as const) {
      expect(can('ADMIN', permission)).toBe(true);
    }
    for (const permission of ['price.request', 'discount.request', 'approval.request'] as const) {
      expect(can('ADMIN', permission)).toBe(false);
    }
  });

  it('staf tidak bisa berbelanja dengan akun staf', () => {
    expect(can('ADMIN', 'shop.buy')).toBe(false);
    expect(can('SPV', 'shop.buy')).toBe(false);
  });

  it('setiap izin dimiliki setidaknya satu role', () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      expect(roles.length, permission).toBeGreaterThan(0);
    }
  });
});

describe('homePathFor', () => {
  it('mengarahkan staf ke dashboard dan customer ke toko', () => {
    expect(homePathFor('ADMIN')).toBe('/dashboard');
    expect(homePathFor('SPV')).toBe('/dashboard');
    expect(homePathFor('CUSTOMER')).toBe('/');
  });
});
