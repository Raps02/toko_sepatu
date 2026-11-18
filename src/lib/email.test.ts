import { afterEach, describe, expect, it, vi } from 'vitest';
import { devPreviewAllowed, emailConfigured, invoiceEmail, passwordResetEmail, sendEmail, securityNoticeEmail } from './email';

const message = { to: { email: 'budi@gmail.com', name: 'Budi' }, subject: 'Tes', html: '<p>Hai</p>', text: 'Hai' };

describe('sendEmail (Brevo)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('tanpa BREVO_API_KEY tidak mengirim apa pun', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchImpl = vi.fn();
    expect(await sendEmail(message, fetchImpl)).toEqual({ sent: false, reason: 'not-configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(emailConfigured()).toBe(false);
  });

  it('mengirim ke API Brevo dengan pengirim dari env', async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('EMAIL_FROM', 'toko@langkahkaki.test');
    vi.stubEnv('EMAIL_FROM_NAME', 'Langkah Kaki');
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: '<abc@brevo>' }), { status: 201 }));

    expect(await sendEmail(message, fetchImpl)).toEqual({ sent: true, messageId: '<abc@brevo>' });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('xkeysib-test');
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { email: 'toko@langkahkaki.test', name: 'Langkah Kaki' },
      to: [{ email: 'budi@gmail.com', name: 'Budi' }],
      subject: 'Tes',
      htmlContent: '<p>Hai</p>',
      textContent: 'Hai',
    });
  });

  it('lampiran (invoice PDF) dikirim sebagai attachment base64', async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('EMAIL_FROM', 'toko@langkahkaki.test');
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    await sendEmail({ ...message, attachments: [{ name: 'INV-LK-261118-ABC234.pdf', content: 'JVBERi0x' }] }, fetchImpl);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body);
    expect(body.attachment).toEqual([{ name: 'INV-LK-261118-ABC234.pdf', content: 'JVBERi0x' }]);
  });

  it('penolakan Brevo dilaporkan sebagai gagal, bukan dilempar', async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('EMAIL_FROM', 'toko@langkahkaki.test');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"sender not valid"}', { status: 400 }));
    expect(await sendEmail(message, fetchImpl)).toEqual({ sent: false, reason: 'failed' });
  });

  it('link email hanya boleh tampil di halaman saat development dan email belum disetel', () => {
    vi.stubEnv('BREVO_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(devPreviewAllowed()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(devPreviewAllowed()).toBe(true);
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('EMAIL_FROM', 'toko@langkahkaki.test');
    expect(devPreviewAllowed()).toBe(false);
  });
});

describe('template email', () => {
  it('email invoice menyebut nomor pesanan, total, dan link pesanan', () => {
    const mail = invoiceEmail({
      name: 'Budi',
      orderNumber: 'LK-261118-ABC234',
      invoiceNumber: 'INV-LK-261118-ABC234',
      total: 'Rp 459.000',
      orderUrl: 'http://localhost:3000/orders/o1',
    });
    expect(mail.subject).toBe('Invoice INV-LK-261118-ABC234 untuk pesanan LK-261118-ABC234');
    expect(mail.text).toContain('Rp 459.000');
    expect(mail.text).toContain('http://localhost:3000/orders/o1');
  });

  it('isi pemberitahuan di-escape supaya tidak jadi HTML', () => {
    const mail = securityNoticeEmail({ what: '<b>Budi</b>' });
    expect(mail.html).toContain('&lt;b&gt;Budi&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Budi</b>');
  });

  it('email reset memuat link dan masa berlaku, tanpa nama akun', () => {
    const mail = passwordResetEmail({ url: 'https://toko.test/reset-password?token=abc', minutes: 30 });
    expect(mail.text).toContain('https://toko.test/reset-password?token=abc');
    expect(mail.text).toContain('30 menit');
    expect(mail.text).toContain('Halo, kami menerima');
  });
});
