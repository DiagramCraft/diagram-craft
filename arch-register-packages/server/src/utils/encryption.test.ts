import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './encryption.js';

const ENCRYPTION_KEY_ENV = 'AI_ENCRYPTION_KEY';

beforeEach(() => {
  delete process.env[ENCRYPTION_KEY_ENV];
});

afterEach(() => {
  delete process.env[ENCRYPTION_KEY_ENV];
});

describe('encrypt / decrypt (no key set)', () => {
  it('returns plaintext unchanged when no key is set', () => {
    expect(encrypt('hello')).toBe('hello');
  });

  it('decrypt returns the input unchanged when no key is set', () => {
    expect(decrypt('some-value')).toBe('some-value');
  });
});

describe('encrypt / decrypt (with key set)', () => {
  beforeEach(() => {
    process.env[ENCRYPTION_KEY_ENV] = 'test-secret-key';
  });

  it('encrypt returns a base64-encoded ciphertext different from plaintext', () => {
    const result = encrypt('my api key');
    expect(result).not.toBe('my api key');
    expect(() => Buffer.from(result, 'base64')).not.toThrow();
  });

  it('round-trips: decrypt(encrypt(x)) === x', () => {
    const plaintext = 'super secret value';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const c1 = encrypt('same');
    const c2 = encrypt('same');
    expect(c1).not.toBe(c2);
  });

  it('round-trips empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('round-trips unicode content', () => {
    const text = '日本語テスト 🔑';
    expect(decrypt(encrypt(text))).toBe(text);
  });
});

describe('decrypt edge cases (with key set)', () => {
  beforeEach(() => {
    process.env[ENCRYPTION_KEY_ENV] = 'test-secret-key';
  });

  it('returns input unchanged when ciphertext is too short to be valid', () => {
    const tooShort = Buffer.from('short').toString('base64');
    expect(decrypt(tooShort)).toBe(tooShort);
  });

  it('throws or returns input when ciphertext is corrupted', () => {
    const valid = encrypt('value');
    const corrupted = valid.slice(0, -4) + 'XXXX';
    expect(() => decrypt(corrupted)).toThrow();
  });
});
