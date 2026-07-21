import { addDuration, generateSecureToken, hashToken } from './crypto.util';

describe('crypto.util', () => {
  it('generates unique hex tokens', () => {
    const a = generateSecureToken(16);
    const b = generateSecureToken(16);
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(a).not.toEqual(b);
  });

  it('hashes tokens deterministically with sha256', () => {
    const hash = hashToken('secret');
    expect(hash).toHaveLength(64);
    expect(hashToken('secret')).toEqual(hash);
    expect(hashToken('other')).not.toEqual(hash);
  });

  it('adds duration units correctly', () => {
    const base = new Date('2026-01-01T00:00:00.000Z');
    expect(addDuration(base, '15m').toISOString()).toBe(
      '2026-01-01T00:15:00.000Z',
    );
    expect(addDuration(base, '1h').toISOString()).toBe(
      '2026-01-01T01:00:00.000Z',
    );
    expect(addDuration(base, '1d').toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });

  it('rejects invalid duration', () => {
    expect(() => addDuration(new Date(), '1w')).toThrow(/Invalid duration/);
  });
});
