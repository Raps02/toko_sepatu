import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botConfig, generateBotReply, systemPrompt, toModelMessages } from './chatbot';

const input = { customerId: 'cust_1', customerName: 'Budi', history: [{ role: 'customer' as const, body: 'Halo' }] };

function openAIResponse(message: object) {
  return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
}

describe('botConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('mati kalau OPENAI_API_KEY kosong', () => {
    vi.stubEnv('OPENAI_API_KEY', '  ');
    expect(botConfig()).toBeNull();
  });

  it('memakai model bawaan kalau OPENAI_MODEL kosong', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('OPENAI_MODEL', '');
    vi.stubEnv('OPENAI_BASE_URL', '');
    expect(botConfig()).toEqual({ apiKey: 'sk-test', model: 'gpt-4.1-mini', baseUrl: 'https://api.openai.com/v1' });
  });

  it('bisa diarahkan ke gateway lain, garis miring di akhir dibuang', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('OPENAI_BASE_URL', 'https://gateway.contoh/api/v1/');
    expect(botConfig()?.baseUrl).toBe('https://gateway.contoh/api/v1');
  });
});

describe('toModelMessages', () => {
  it('memetakan pembeli ke user, bot dan staf ke assistant dengan penanda staf', () => {
    expect(
      toModelMessages([
        { role: 'customer', body: 'Ada ukuran 38?' },
        { role: 'bot', body: 'Ada.' },
        { role: 'staff', body: 'Sudah kami cek.' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Ada ukuran 38?' },
      { role: 'assistant', content: 'Ada.' },
      { role: 'assistant', content: '[Staf toko] Sudah kami cek.' },
    ]);
  });

  it('hanya mengirim 20 pesan terakhir', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: 'customer' as const, body: `pesan ${i}` }));
    const result = toModelMessages(history);
    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ role: 'user', content: 'pesan 10' });
  });
});

describe('systemPrompt', () => {
  it('menyebut produk yang sedang dibuka kalau ada', () => {
    expect(systemPrompt({ customerName: 'Budi', viewingProduct: 'Sandar Senja Flat' })).toContain('Sandar Senja Flat');
    expect(systemPrompt({ customerName: 'Budi' })).not.toContain('sedang membuka halaman produk');
  });
});

describe('generateBotReply', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    // Jangan ikut isi .env developer.
    vi.stubEnv('OPENAI_BASE_URL', '');
    vi.stubEnv('OPENAI_MODEL', '');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tidak memanggil API kalau bot belum disetel', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(await generateBotReply(input)).toEqual({ kind: 'error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mengembalikan jawaban teks dan mengirim key lewat header', async () => {
    fetchMock.mockResolvedValueOnce(openAIResponse({ content: '  Halo Budi!  ' }));

    expect(await generateBotReply(input)).toEqual({ kind: 'reply', body: 'Halo Budi!' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body).messages[0].role).toBe('system');
  });

  it('menyerahkan ke staf saat model memanggil handoff_to_staff', async () => {
    fetchMock.mockResolvedValueOnce(
      openAIResponse({
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'handoff_to_staff', arguments: '{"reason":"Barang rusak"}' } }],
      }),
    );

    const result = await generateBotReply(input);
    expect(result).toMatchObject({ kind: 'handoff', reason: 'Barang rusak' });
  });

  it('menjalankan tool lalu meneruskan hasilnya ke model', async () => {
    fetchMock
      .mockResolvedValueOnce(
        openAIResponse({
          content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'tool_tidak_ada', arguments: '{}' } }],
        }),
      )
      .mockResolvedValueOnce(openAIResponse({ content: 'Maaf, aku cek ke staf dulu ya.' }));

    expect(await generateBotReply(input)).toEqual({ kind: 'reply', body: 'Maaf, aku cek ke staf dulu ya.' });
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });

  it('gagal dengan aman saat API error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"quota"}', { status: 429 }));
    expect(await generateBotReply(input)).toEqual({ kind: 'error' });
  });
});
