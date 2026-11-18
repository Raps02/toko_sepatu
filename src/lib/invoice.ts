import type { OrderStatus } from '@prisma/client';
import { LineCapStyle, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { BRAND_COLORS, BRAND_MARK } from '@/lib/brand';
import { formatDate, formatDateTime, formatRupiah } from '@/lib/format';
import { SITE, STORE_CONTACT } from '@/lib/site';

// Invoice PDF dibuat di server dari data order. Logo digambar sebagai vektor
// dari path yang sama dengan logo di website (`src/lib/brand.ts`), jadi tetap
// tajam saat dicetak dan tidak bergantung pada file gambar.

/** Invoice hanya ada untuk pesanan yang pembayarannya sudah diterima. */
const INVOICE_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

export function hasInvoice(status: OrderStatus): boolean {
  return INVOICE_STATUSES.includes(status);
}

/**
 * Kode invoice memakai awalan toko LK (Langkah Kaki). Pesanan lama masih
 * bernomor TPK-… di database (nomor itu juga yang dikenal Midtrans), jadi
 * awalannya diganti di sini saja, tanpa mengubah nomor pesanannya.
 */
export function invoiceNumber(orderNumber: string): string {
  return `INV-${orderNumber.replace(/^TPK-/, 'LK-')}`;
}

export type InvoiceData = {
  orderNumber: string;
  createdAt: Date;
  paidAt: Date | null;
  paymentMethod: string | null;
  customer: { name: string; email: string };
  shipTo: { recipient: string; phone: string; street: string; city: string; province: string; postalCode: string };
  courier: string | null;
  trackingNumber: string | null;
  items: { productName: string; color: string; size: string; quantity: number; unitPrice: number; discountAmount: number }[];
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
};

/**
 * Font bawaan PDF hanya mengenal huruf Latin. Karakter lain (emoji, aksara
 * non-Latin) membuat pdf-lib melempar error, jadi dibuang dulu.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA1-\xFF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hex(color: string): RGB {
  const n = Number.parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const INK = hex(BRAND_COLORS.ink);
const ACCENT = hex(BRAND_COLORS.accent);
const MUTED = hex('#707072');
const LINE = hex('#E5E5E5');
const BAND = hex('#F5F5F5');
const WHITE = rgb(1, 1, 1);

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const RIGHT = PAGE_WIDTH - MARGIN;
const BOTTOM = 72;

// Tepi kanan tiap kolom angka di tabel barang.
const COL = { item: MARGIN + 10, qty: MARGIN + 240, price: MARGIN + 318, discount: MARGIN + 398, total: RIGHT - 10 };
const ITEM_WIDTH = 190;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of pdfSafe(text).split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const number = invoiceNumber(data.orderNumber);
  doc.setTitle(`Invoice ${number}`);
  doc.setAuthor(SITE.name);
  doc.setSubject(`Invoice pembelian ${data.orderNumber}`);
  doc.setCreationDate(data.paidAt ?? data.createdAt);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const text = (value: string, x: number, atY: number, options: { size?: number; font?: PDFFont; color?: RGB } = {}) =>
    page.drawText(pdfSafe(value), { x, y: atY, size: options.size ?? 10, font: options.font ?? regular, color: options.color ?? INK });

  const textRight = (value: string, right: number, atY: number, options: { size?: number; font?: PDFFont; color?: RGB } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const safe = pdfSafe(value);
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y: atY, size, font, color: options.color ?? INK });
  };

  const rule = (atY: number, color: RGB = LINE, thickness = 1) =>
    page.drawLine({ start: { x: MARGIN, y: atY }, end: { x: RIGHT, y: atY }, thickness, color });

  const tableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 22, width: RIGHT - MARGIN, height: 22, color: BAND });
    const labelY = y - 15;
    text('Barang', COL.item, labelY, { size: 9, font: bold, color: MUTED });
    textRight('Jumlah', COL.qty, labelY, { size: 9, font: bold, color: MUTED });
    textRight('Harga satuan', COL.price, labelY, { size: 9, font: bold, color: MUTED });
    textRight('Diskon', COL.discount, labelY, { size: 9, font: bold, color: MUTED });
    textRight('Subtotal', COL.total, labelY, { size: 9, font: bold, color: MUTED });
    y -= 22;
  };

  /** Pindah ke halaman baru kalau sisa ruang tidak cukup. */
  const ensureSpace = (needed: number, repeatHeader = false) => {
    if (y - needed >= BOTTOM) return;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    if (repeatHeader) tableHeader();
  };

  // ── Kop: logo + nama toko di kiri, judul dan nomor invoice di kanan ──
  const logoScale = 1.25;
  const logoHeight = BRAND_MARK.height * logoScale;
  const logoTop = y;
  page.drawSvgPath(BRAND_MARK.stepLeft, { x: MARGIN, y: logoTop, scale: logoScale, color: INK });
  page.drawSvgPath(BRAND_MARK.stepRight, { x: MARGIN, y: logoTop, scale: logoScale, color: ACCENT });
  page.drawSvgPath(BRAND_MARK.sole, {
    x: MARGIN,
    y: logoTop,
    scale: logoScale,
    borderColor: INK,
    borderWidth: BRAND_MARK.soleWidth,
    borderLineCap: LineCapStyle.Round,
  });

  const nameX = MARGIN + BRAND_MARK.width * logoScale + 8;
  text(SITE.name.toUpperCase(), nameX, logoTop - 21, { size: 19, font: bold });
  text(SITE.tagline, nameX, logoTop - 33, { size: 8.5, color: MUTED });

  textRight('INVOICE', RIGHT, logoTop - 22, { size: 26, font: bold });
  textRight(number, RIGHT, logoTop - 36, { size: 10, color: MUTED });

  y = logoTop - logoHeight - 22;
  const sellerLines = [STORE_CONTACT.address, [STORE_CONTACT.phone, STORE_CONTACT.email].filter(Boolean).join('  |  ')].filter(Boolean);
  for (const line of sellerLines) {
    for (const wrapped of wrap(line, regular, 8.5, 300)) {
      text(wrapped, MARGIN, y, { size: 8.5, color: MUTED });
      y -= 11;
    }
  }
  y -= sellerLines.length ? 6 : 0;
  rule(y, INK, 1.5);
  y -= 26;

  // ── Pembeli, alamat kirim, dan ringkasan pembayaran ──
  const blockTop = y;
  const columnWidth = 145;
  const drawBlock = (title: string, x: number, lines: { value: string; font?: PDFFont; color?: RGB }[]) => {
    let cursor = blockTop;
    text(title, x, cursor, { size: 8.5, font: bold, color: MUTED });
    cursor -= 15;
    for (const line of lines) {
      for (const wrapped of wrap(line.value, line.font ?? regular, 10, columnWidth)) {
        text(wrapped, x, cursor, { font: line.font, color: line.color });
        cursor -= 13;
      }
    }
    return cursor;
  };

  const billedBottom = drawBlock('Ditagihkan kepada', MARGIN, [
    { value: data.customer.name, font: bold },
    { value: data.customer.email, color: MUTED },
  ]);
  const shipBottom = drawBlock('Dikirim ke', MARGIN + 160, [
    { value: data.shipTo.recipient, font: bold },
    { value: data.shipTo.phone, color: MUTED },
    { value: `${data.shipTo.street}, ${data.shipTo.city}, ${data.shipTo.province} ${data.shipTo.postalCode}` },
  ]);

  // Kolom kanan: label di kiri, nilai rata kanan.
  const metaX = MARGIN + 322;
  let metaY = blockTop;
  const meta = (label: string, value: string) => {
    text(label, metaX, metaY, { size: 9, color: MUTED });
    textRight(value, RIGHT, metaY, { size: 9.5 });
    metaY -= 15;
  };
  meta('Nomor pesanan', data.orderNumber);
  meta('Tanggal pesanan', formatDate(data.createdAt));
  if (data.paidAt) meta('Tanggal bayar', formatDateTime(data.paidAt));
  if (data.paymentMethod) meta('Metode bayar', data.paymentMethod.replace(/_/g, ' '));

  // Cap LUNAS.
  if (data.paidAt) {
    const label = 'LUNAS';
    const width = bold.widthOfTextAtSize(label, 10) + 18;
    page.drawRectangle({ x: RIGHT - width, y: metaY - 8, width, height: 19, color: ACCENT });
    text(label, RIGHT - width + 9, metaY - 2.5, { size: 10, font: bold, color: WHITE });
    metaY -= 26;
  }

  y = Math.min(billedBottom, shipBottom, metaY) - 16;

  // ── Tabel barang ──
  tableHeader();
  for (const item of data.items) {
    const nameLines = wrap(item.productName, bold, 10, ITEM_WIDTH);
    const rowHeight = nameLines.length * 13 + 13 + 14;
    ensureSpace(rowHeight, true);

    let rowY = y - 17;
    const firstLineY = rowY;
    for (const line of nameLines) {
      text(line, COL.item, rowY, { font: bold });
      rowY -= 13;
    }
    text(`${item.color}, ukuran ${item.size}`, COL.item, rowY, { size: 9, color: MUTED });

    const lineDiscount = item.discountAmount * item.quantity;
    textRight(String(item.quantity), COL.qty, firstLineY);
    textRight(formatRupiah(item.unitPrice), COL.price, firstLineY);
    textRight(lineDiscount > 0 ? `-${formatRupiah(lineDiscount)}` : '-', COL.discount, firstLineY, { color: lineDiscount > 0 ? INK : MUTED });
    textRight(formatRupiah((item.unitPrice - item.discountAmount) * item.quantity), COL.total, firstLineY, { font: bold });

    y -= rowHeight;
    rule(y);
  }

  // ── Total ──
  ensureSpace(120);
  y -= 20;
  const totalLabelX = MARGIN + 290;
  const totalRow = (label: string, value: string) => {
    text(label, totalLabelX, y, { color: MUTED });
    textRight(value, COL.total, y);
    y -= 17;
  };
  totalRow('Harga barang', formatRupiah(data.subtotal));
  if (data.discountTotal > 0) totalRow('Diskon', `-${formatRupiah(data.discountTotal)}`);
  totalRow('Ongkos kirim', formatRupiah(data.shippingCost));

  y -= 16;
  page.drawRectangle({ x: totalLabelX - 12, y: y - 12, width: RIGHT - totalLabelX + 12, height: 30, color: INK });
  text('Total dibayar', totalLabelX, y - 2, { size: 11, font: bold, color: WHITE });
  textRight(formatRupiah(data.total), COL.total, y - 3, { size: 13, font: bold, color: WHITE });
  y -= 42;

  if (data.courier && data.trackingNumber) {
    ensureSpace(30);
    text('Pengiriman', MARGIN, y, { size: 8.5, font: bold, color: MUTED });
    text(`${data.courier}, nomor resi ${data.trackingNumber}`, MARGIN, y - 14);
    y -= 34;
  }

  // ── Catatan kaki di setiap halaman ──
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: 52 }, end: { x: RIGHT, y: 52 }, thickness: 1, color: LINE });
    current.drawText(pdfSafe(`Invoice ini dibuat otomatis oleh sistem ${SITE.name} dan sah tanpa tanda tangan.`), {
      x: MARGIN,
      y: 38,
      size: 8,
      font: regular,
      color: MUTED,
    });
    const pageLabel = `Halaman ${index + 1} dari ${pages.length}`;
    current.drawText(pageLabel, { x: RIGHT - regular.widthOfTextAtSize(pageLabel, 8), y: 38, size: 8, font: regular, color: MUTED });
  });

  return doc.save();
}
