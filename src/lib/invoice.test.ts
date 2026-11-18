import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { hasInvoice, invoiceNumber, pdfSafe, renderInvoicePdf, type InvoiceData } from '@/lib/invoice';

const order = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
  orderNumber: 'LK-261116-K7M2QX',
  createdAt: new Date('2026-11-16T03:10:00Z'),
  paidAt: new Date('2026-11-16T03:24:00Z'),
  paymentMethod: 'bank_transfer',
  customer: { name: 'Budi Pembeli', email: 'budi@example.com' },
  shipTo: { recipient: 'Budi Pembeli', phone: '081234567890', street: 'Jl. Kebon Jeruk No. 12', city: 'Jakarta Barat', province: 'DKI Jakarta', postalCode: '11530' },
  courier: 'JNE',
  trackingNumber: 'JNE0012345678',
  items: [{ productName: 'Aero Run 2', color: 'Hitam', size: '42', quantity: 2, unitPrice: 749000, discountAmount: 112350 }],
  subtotal: 1498000,
  discountTotal: 224700,
  shippingCost: 10000,
  total: 1283300,
  ...overrides,
});

const header = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes.slice(0, 5));
// Isi PDF terkompresi, jadi jumlah halaman dibaca dengan membuka kembali filenya.
const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('hasInvoice', () => {
  it('invoice hanya ada setelah pembayaran diterima', () => {
    for (const status of ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] as const) expect(hasInvoice(status)).toBe(true);
    for (const status of ['PENDING_PAYMENT', 'CANCELLED', 'EXPIRED'] as const) expect(hasInvoice(status)).toBe(false);
  });
});

describe('invoiceNumber', () => {
  it('diturunkan dari nomor pesanan', () => {
    expect(invoiceNumber('LK-261116-K7M2QX')).toBe('INV-LK-261116-K7M2QX');
  });

  it('pesanan lama ber-awalan TPK tetap dapat kode invoice LK', () => {
    expect(invoiceNumber('TPK-261116-K7M2QX')).toBe('INV-LK-261116-K7M2QX');
  });
});

describe('pdfSafe', () => {
  it('membiarkan teks Latin biasa, termasuk huruf beraksen', () => {
    expect(pdfSafe('Jl. Kebon Jeruk No. 12, RT 03/RW 05')).toBe('Jl. Kebon Jeruk No. 12, RT 03/RW 05');
    expect(pdfSafe('Café Élan')).toBe('Café Élan');
  });

  it('mengganti tanda kutip dan strip tipografis dengan padanan ASCII', () => {
    expect(pdfSafe('“Kanvas” ‘putih’ – edisi — baru')).toBe('"Kanvas" \'putih\' - edisi - baru');
  });

  it('membuang karakter yang tidak dikenal font PDF dan merapikan spasi', () => {
    expect(pdfSafe('Kota Low 🎉  スニーカー')).toBe('Kota Low');
    expect(pdfSafe('baris satu\n\tbaris dua')).toBe('baris satu baris dua');
  });
});

describe('renderInvoicePdf', () => {
  it('menghasilkan file PDF satu halaman untuk pesanan biasa', async () => {
    const bytes = await renderInvoicePdf(order());
    expect(header(bytes)).toBe('%PDF-');
    expect(await pageCount(bytes)).toBe(1);
  });

  it('tidak gagal untuk nama produk atau alamat berisi emoji dan aksara non-Latin', async () => {
    const data = order({
      items: [{ productName: 'Sepatu 🎉 スニーカー “Edisi” Khusus', color: 'Merah 🔥', size: '42', quantity: 1, unitPrice: 500000, discountAmount: 0 }],
    });
    data.shipTo.street = 'Jl. Mawar №5 — dekat 🏠';
    data.customer.name = '山田 Budi';
    expect(header(await renderInvoicePdf(data))).toBe('%PDF-');
  });

  it('tetap jadi untuk pesanan tanpa kurir, metode bayar, atau tanggal bayar', async () => {
    const bytes = await renderInvoicePdf(order({ courier: null, trackingNumber: null, paymentMethod: null, paidAt: null }));
    expect(header(bytes)).toBe('%PDF-');
  });

  it('menyambung ke halaman berikutnya kalau barangnya banyak', async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      productName: `Sepatu contoh nomor ${i + 1}`,
      color: 'Hitam',
      size: '42',
      quantity: 1,
      unitPrice: 100000,
      discountAmount: 0,
    }));
    const bytes = await renderInvoicePdf(order({ items, subtotal: 4000000, discountTotal: 0, total: 4010000 }));
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });
});
