import { createHash, timingSafeEqual } from 'node:crypto';

// Integrasi Midtrans Snap lewat HTTP biasa (tanpa SDK). Pembeli diarahkan ke
// halaman pembayaran Midtrans; hasilnya dikabarkan Midtrans ke webhook kita di
// `/api/webhooks/midtrans`. Kunci server tidak pernah dikirim ke browser.

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const SNAP_URL = isProduction
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const API_URL = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

function serverKey(): string | null {
  return process.env.MIDTRANS_SERVER_KEY?.trim() || null;
}

export function isMidtransConfigured(): boolean {
  return serverKey() !== null;
}

function authHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export type SnapItem = { id: string; name: string; price: number; quantity: number };

type SnapRequest = {
  orderNumber: string;
  grossAmount: number;
  items: SnapItem[];
  customer: { name: string; email: string; phone?: string | null };
  /** Sisa waktu bayar; disamakan dengan `Order.expiresAt`. */
  expiryMinutes: number;
  finishUrl: string;
};

export async function createSnapTransaction(request: SnapRequest): Promise<{ token: string; redirectUrl: string }> {
  const key = serverKey();
  if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diisi');

  const response = await fetch(SNAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader(key) },
    body: JSON.stringify({
      transaction_details: { order_id: request.orderNumber, gross_amount: request.grossAmount },
      // Jumlah seluruh item harus sama persis dengan gross_amount.
      item_details: request.items.map((item) => ({ ...item, name: item.name.slice(0, 50) })),
      customer_details: {
        first_name: request.customer.name.slice(0, 50),
        email: request.customer.email,
        phone: request.customer.phone ?? undefined,
      },
      expiry: { unit: 'minutes', duration: Math.max(1, Math.floor(request.expiryMinutes)) },
      callbacks: { finish: request.finishUrl },
    }),
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => null)) as { token?: string; redirect_url?: string; error_messages?: string[] } | null;
  if (!response.ok || !body?.token || !body.redirect_url) {
    throw new Error(`Midtrans menolak transaksi (${response.status}): ${body?.error_messages?.join('; ') ?? 'tanpa keterangan'}`);
  }
  return { token: body.token, redirectUrl: body.redirect_url };
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
};

/** signature_key = SHA-512(order_id + status_code + gross_amount + server key). */
export function computeSignature(
  notification: Pick<MidtransNotification, 'order_id' | 'status_code' | 'gross_amount'>,
  key: string,
): string {
  return createHash('sha512')
    .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${key}`)
    .digest('hex');
}

export function verifySignature(notification: MidtransNotification, key: string | null = serverKey()): boolean {
  if (!key || typeof notification.signature_key !== 'string') return false;
  const expected = Buffer.from(computeSignature(notification, key), 'utf8');
  const received = Buffer.from(notification.signature_key.toLowerCase(), 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type PaymentOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

export function outcomeOf(transactionStatus: string, fraudStatus?: string): PaymentOutcome {
  switch (transactionStatus) {
    case 'settlement':
      return 'PAID';
    case 'capture':
      // Kartu kredit: dana dianggap masuk hanya kalau lolos pemeriksaan fraud.
      return fraudStatus === 'accept' || fraudStatus === undefined ? 'PAID' : 'PENDING';
    case 'expire':
      return 'EXPIRED';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'FAILED';
    case 'refund':
    case 'partial_refund':
    case 'chargeback':
      return 'REFUNDED';
    default:
      return 'PENDING';
  }
}

/** Tanya status langsung ke Midtrans; dipakai webhook dan sinkronisasi status order. */
export async function fetchTransactionStatus(orderNumber: string): Promise<MidtransNotification | null> {
  const key = serverKey();
  if (!key) return null;
  try {
    const response = await fetch(`${API_URL}/v2/${encodeURIComponent(orderNumber)}/status`, {
      headers: { Accept: 'application/json', Authorization: authHeader(key) },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => null)) as Partial<MidtransNotification> | null;
    // Midtrans mengembalikan HTTP 200 dengan status_code "404" (tanpa transaction_status)
    // jika pelanggan belum memilih metode pembayaran di Snap.
    if (!data || typeof data.transaction_status !== 'string') return null;
    return data as MidtransNotification;
  } catch {
    return null;
  }
}
