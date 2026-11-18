import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, inCooldown, RESEND_COOLDOWN_SECONDS, tokenUsable } from './auth-tokens';

describe('token sekali pakai', () => {
  it('token acak dan yang disimpan hanya hash-nya', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });

  it('tidak bisa dipakai kalau sudah kedaluwarsa atau sudah terpakai', () => {
    const now = new Date('2026-11-18T10:00:00Z');
    const later = new Date('2026-11-18T10:30:00Z');
    expect(tokenUsable({ expiresAt: later, usedAt: null }, now)).toBe(true);
    expect(tokenUsable({ expiresAt: now, usedAt: null }, later)).toBe(false);
    expect(tokenUsable({ expiresAt: later, usedAt: now }, now)).toBe(false);
    expect(tokenUsable(null, now)).toBe(false);
  });

  it('permintaan email berulang ditahan selama jeda kirim ulang', () => {
    const now = new Date('2026-11-18T10:00:00Z');
    expect(inCooldown(new Date(now.getTime() - 10_000), now)).toBe(true);
    expect(inCooldown(new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000 - 1), now)).toBe(false);
    expect(inCooldown(null, now)).toBe(false);
  });
});
