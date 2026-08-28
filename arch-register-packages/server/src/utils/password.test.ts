import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

// Generated with argon2 0.44.0 using the production parameters. This keeps a
// pre-upgrade PHC value in the suite so upgrades cannot silently invalidate
// existing password hashes.
const preUpgradeHash =
  '$argon2id$v=19$m=65536,t=3,p=4$zcw7jrokQusFGcNlV/2r7A$+tP/6KgrTLgiU4lwYOW0j/APum2tWtX51G60XjMU+hY';

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

  it('preserves the configured Argon2id parameters', async () => {
    const hash = await hashPassword('secret');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,(?:t=3,p=4|p=4,t=3)\$/);
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

  it('verifies a hash created before the Argon2 upgrade', async () => {
    expect(await verifyPassword(preUpgradeHash, 'legacy-password')).toBe(true);
    expect(await verifyPassword(preUpgradeHash, 'wrong-password')).toBe(false);
  });

  it.each([
    'not-a-valid-hash',
    '$argon2id$v=19$m=65536,t=3,p=4$',
    '$argon2id$v=19$m=65536,t=3,p=4$%%%%$%%%%'
  ])('returns false for malformed hash %j without throwing', async malformedHash => {
    expect(await verifyPassword(malformedHash, 'password')).toBe(false);
  });

  it('returns false for empty password against a real hash', async () => {
    const hash = await hashPassword('secret');
    expect(await verifyPassword(hash, '')).toBe(false);
  });
});
