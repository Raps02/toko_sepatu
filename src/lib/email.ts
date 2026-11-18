import { SITE } from '@/lib/site';

// Kirim email transaksional lewat API Brevo (https://developers.brevo.com).
// Tanpa BREVO_API_KEY, email tidak dikirim: isinya dicatat di console server,
// dan di mode development link penting ditampilkan di halaman (lihat devPreviewAllowed).

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export type EmailMessage = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  /** Lampiran, isi dalam base64 (mis. invoice PDF). */
  attachments?: { name: string; content: string }[];
};

export type EmailResult = { sent: true; messageId: string | null } | { sent: false; reason: 'not-configured' | 'failed' };

export function emailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

/**
 * Boleh menampilkan link email langsung di halaman: hanya saat development dan email
 * belum disetel, sama seperti tombol "Tandai dibayar (uji coba)" untuk Midtrans.
 */
export function devPreviewAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && !emailConfigured();
}

export async function sendEmail(message: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  if (!emailConfigured()) {
    const files = message.attachments?.length ? `\nLampiran: ${message.attachments.map((a) => a.name).join(', ')}` : '';
    console.info(`[email belum disetel] Ke: ${message.to.email} | ${message.subject}\n${message.text}${files}`);
    return { sent: false, reason: 'not-configured' };
  }

  try {
    const response = await fetchImpl(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!.trim(), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM!.trim(), name: process.env.EMAIL_FROM_NAME?.trim() || SITE.name },
        to: [{ email: message.to.email, ...(message.to.name ? { name: message.to.name } : {}) }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        ...(message.attachments?.length ? { attachment: message.attachments } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Isi respons Brevo bisa memuat detail akun; cukup status dan pesan singkatnya.
      const detail = await response.text().catch(() => '');
      console.error(`[email] Brevo menolak (${response.status}): ${detail.slice(0, 200)}`);
      return { sent: false, reason: 'failed' };
    }
    const body = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { sent: true, messageId: body.messageId ?? null };
  } catch (error) {
    console.error('[email] Gagal menghubungi Brevo:', error instanceof Error ? error.message : error);
    return { sent: false, reason: 'failed' };
  }
}

// ───────────────────────── Template ─────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Kerangka email sederhana yang aman di klien email (tabel + gaya inline). */
function layout({ heading, paragraphs, button, footnote }: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }) {
  const html = `<!doctype html><html lang="id"><body style="margin:0;background:#f2f4f5;font-family:Arial,Helvetica,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:bold;letter-spacing:.02em">${escapeHtml(SITE.name.toUpperCase())}</td></tr>
<tr><td style="padding:8px 28px 0;font-size:18px;font-weight:bold">${escapeHtml(heading)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.55;color:#333333">${escapeHtml(p)}</td></tr>`).join('\n')}
${button ? `<tr><td style="padding:24px 28px 4px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(button.label)}</a></td></tr>
<tr><td style="padding:12px 28px 0;font-size:12px;line-height:1.5;color:#707072">Kalau tombol tidak bisa diklik, salin link ini ke browser:<br><span style="word-break:break-all">${escapeHtml(button.url)}</span></td></tr>` : ''}
<tr><td style="padding:24px 28px 28px;font-size:12px;line-height:1.5;color:#707072">${escapeHtml(footnote ?? `Email ini dikirim otomatis oleh ${SITE.name}. Jangan balas email ini.`)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', footnote ?? `Email otomatis dari ${SITE.name}.`].join('\n');
  return { html, text };
}

export function passwordResetEmail({ url, minutes }: { url: string; minutes: number }) {
  return {
    subject: `Atur ulang kata sandi ${SITE.name}`,
    ...layout({
      heading: 'Atur ulang kata sandi',
      paragraphs: [
        `Halo, kami menerima permintaan untuk mengatur ulang kata sandi akun ${SITE.name} kamu.`,
        `Klik tombol di bawah untuk membuat kata sandi baru. Link ini berlaku ${minutes} menit dan hanya bisa dipakai sekali.`,
      ],
      button: { label: 'Buat kata sandi baru', url },
      footnote: 'Kalau kamu tidak meminta ini, abaikan saja email ini. Kata sandimu tidak akan berubah.',
    }),
  };
}

export function emailChangeConfirmEmail({ url, minutes, newEmail }: { url: string; minutes: number; newEmail: string }) {
  return {
    subject: `Konfirmasi email baru akun ${SITE.name}`,
    ...layout({
      heading: 'Konfirmasi email baru',
      paragraphs: [
        `Halo, ada permintaan mengganti email akun ${SITE.name} menjadi ${newEmail}.`,
        `Klik tombol di bawah untuk mengonfirmasi. Link ini berlaku ${minutes} menit.`,
      ],
      button: { label: 'Konfirmasi email ini', url },
      footnote: 'Kalau kamu tidak meminta ini, abaikan saja email ini. Email akunmu tidak akan berubah.',
    }),
  };
}

export function invoiceEmail({ name, orderNumber, invoiceNumber, total, orderUrl }: { name: string; orderNumber: string; invoiceNumber: string; total: string; orderUrl: string }) {
  return {
    subject: `Invoice ${invoiceNumber} untuk pesanan ${orderNumber}`,
    ...layout({
      heading: 'Pembayaranmu sudah kami terima',
      paragraphs: [
        `Halo ${name}, terima kasih sudah belanja di ${SITE.name}. Pembayaran pesanan ${orderNumber} sebesar ${total} sudah kami terima.`,
        `Invoice ${invoiceNumber} terlampir di email ini dalam bentuk PDF. Pesananmu sedang kami siapkan, dan kabar pengirimannya bisa dipantau di halaman pesanan.`,
      ],
      button: { label: 'Lihat pesanan', url: orderUrl },
    }),
  };
}

export function securityNoticeEmail({ what }: { what: string }) {
  return {
    subject: `Pemberitahuan keamanan akun ${SITE.name}`,
    ...layout({
      heading: 'Ada perubahan di akunmu',
      paragraphs: [
        `Halo, ${what}`,
        `Kalau ini bukan kamu, segera atur ulang kata sandi lewat halaman "Lupa kata sandi" dan hubungi toko.`,
      ],
    }),
  };
}
