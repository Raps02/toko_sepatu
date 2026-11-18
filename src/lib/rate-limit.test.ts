import { describe, expect, it } from 'vitest';
import { clientIp, limitKey, loginRules } from './rate-limit';

const headers = (values: Record<string, string>) => new Headers(values);

describe('clientIp', () => {
  it('memakai entri terakhir, bukan entri yang bisa dipalsukan pengunjung', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('2.2.2.2');
  });
  it('tanpa header tetap punya nilai', () => {
    expect(clientIp(headers({}))).toBe('unknown');
  });
});

describe('kunci batas', () => {
  it('email disimpan sebagai hash dan tidak peka huruf besar', () => {
    const key = limitKey('login-email', 'Budi@Gmail.com ');
    expect(key).toBe(limitKey('login-email', 'budi@gmail.com'));
    expect(key).not.toContain('budi');
  });
  it('batas per email tidak berubah walau IP berganti', () => {
    expect(loginRules('a@b.co', '1.1.1.1')[1].key).toBe(loginRules('a@b.co', '2.2.2.2')[1].key);
    expect(loginRules('a@b.co', '1.1.1.1')[0].key).not.toBe(loginRules('a@b.co', '2.2.2.2')[0].key);
  });
});
