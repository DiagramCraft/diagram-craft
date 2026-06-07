import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword', () => {
  it('returns a non-empty string', async () => {
    const hash = await hashPassword('secret');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces an argon2 hash (starts with $argon2id$)', async () => {
    const hash = await hashPassword('secret');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyPassword', () => {
  it('returns true for a matching password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword(hash, 'correct-horse')).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword(hash, 'wrong-horse')).toBe(false);
  });

  it('returns false for an invalid hash string (no throw)', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'password')).toBe(false);
  });

  it('returns false for empty password against a real hash', async () => {
    const hash = await hashPassword('secret');
    expect(await verifyPassword(hash, '')).toBe(false);
  });
});
