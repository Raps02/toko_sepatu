import { describe, expect, it } from 'vitest';
import { decideGoogleSignIn, googleLinkData, type GoogleProfileInput } from './google-auth';

const profile: GoogleProfileInput = { sub: 'google-123', email: 'budi@gmail.com', emailVerified: true, name: 'Budi' };
const customer = { id: 'u1', role: 'CUSTOMER' as const, isActive: true, googleId: null };

describe('googleLinkData', () => {
  it('mencabut password lama dan sesi lama saat akun bersandi disambungkan', () => {
    expect(googleLinkData('g1', true)).toEqual({ googleId: 'g1', passwordHash: null, sessionVersion: { increment: 1 } });
  });
  it('akun tanpa password cukup disambungkan', () => {
    expect(googleLinkData('g1', false)).toEqual({ googleId: 'g1' });
  });
});

describe('decideGoogleSignIn', () => {
  it('akun yang sudah tersambung ke Google langsung masuk', () => {
    expect(decideGoogleSignIn(profile, { ...customer, googleId: 'google-123' }, null)).toEqual({ action: 'login', userId: 'u1' });
  });

  it('email sudah terdaftar (daftar pakai password): disambungkan lalu masuk', () => {
    expect(decideGoogleSignIn(profile, null, customer)).toEqual({ action: 'link', userId: 'u1' });
  });

  it('belum ada akun sama sekali: dibuat otomatis', () => {
    expect(decideGoogleSignIn(profile, null, null)).toEqual({ action: 'create' });
  });

  it('staf wajib masuk dengan email dan password', () => {
    for (const role of ['ADMIN', 'SPV'] as const) {
      expect(decideGoogleSignIn(profile, null, { ...customer, role })).toEqual({ action: 'reject', reason: 'staff' });
      expect(decideGoogleSignIn(profile, { ...customer, role, googleId: 'google-123' }, null)).toEqual({ action: 'reject', reason: 'staff' });
    }
  });

  it('akun nonaktif ditolak', () => {
    expect(decideGoogleSignIn(profile, null, { ...customer, isActive: false })).toEqual({ action: 'reject', reason: 'inactive' });
  });

  it('email yang belum diverifikasi Google tidak boleh menyambung atau membuat akun', () => {
    const unverified = { ...profile, emailVerified: false };
    expect(decideGoogleSignIn(unverified, null, customer)).toEqual({ action: 'reject', reason: 'unverified' });
    expect(decideGoogleSignIn(unverified, null, null)).toEqual({ action: 'reject', reason: 'unverified' });
  });

  it('email yang sudah tersambung ke akun Google lain ditolak', () => {
    expect(decideGoogleSignIn(profile, null, { ...customer, googleId: 'google-lain' })).toEqual({
      action: 'reject',
      reason: 'linked-elsewhere',
    });
  });
});
