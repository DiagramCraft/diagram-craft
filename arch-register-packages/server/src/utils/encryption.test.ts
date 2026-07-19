import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiEncryptionError, decrypt, encrypt, VERSIONED_CIPHERTEXT_PREFIX } from './encryption';

const ENCRYPTION_KEY_ENV = 'AI_ENCRYPTION_KEY';
const ENCRYPTION_SALT_ENV = 'AI_ENCRYPTION_SALT';

beforeEach(() => {
  delete process.env[ENCRYPTION_KEY_ENV];
  delete process.env[ENCRYPTION_SALT_ENV];
});

afterEach(() => {
  delete process.env[ENCRYPTION_KEY_ENV];
  delete process.env[ENCRYPTION_SALT_ENV];
});

describe('encrypt / decrypt (no key set)', () => {
  it('rejects plaintext writes when encryption is not configured', () => {
    expect(() => encrypt('hello')).toThrowError(AiEncryptionError);
    expect(() => encrypt('hello')).toThrowError('AI_ENCRYPTION_KEY is required');
  });

  it('continues reading legacy plaintext values', () => {
    expect(decrypt('legacy-plain-value')).toBe('legacy-plain-value');
  });

  it('rejects versioned values when the encryption key is unavailable', () => {
    expect(() => decrypt(`${VERSIONED_CIPHERTEXT_PREFIX}invalid`)).toThrowError(
      'AI_ENCRYPTION_KEY is required'
    );
  });
});

describe('encrypt / decrypt (with key set)', () => {
  beforeEach(() => {
    process.env[ENCRYPTION_KEY_ENV] = 'test-secret-key';
  });

  it('writes a versioned base64 ciphertext different from plaintext', () => {
    const result = encrypt('my api key');
    expect(result).toMatch(/^v1:/);
    expect(result).not.toBe('my api key');
  });

  it('round-trips versioned ciphertext', () => {
    const plaintext = 'super secret value';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const c1 = encrypt('same');
    const c2 = encrypt('same');
    expect(c1).not.toBe(c2);
  });

  it('round-trips empty and unicode content', () => {
    expect(decrypt(encrypt(''))).toBe('');
    expect(decrypt(encrypt('日本語テスト 🔑'))).toBe('日本語テスト 🔑');
  });

  it('continues reading unmarked legacy plaintext', () => {
    expect(decrypt('legacy-plain-value')).toBe('legacy-plain-value');
  });

  it('fails closed for a wrong key', () => {
    const ciphertext = encrypt('value');
    process.env[ENCRYPTION_KEY_ENV] = 'wrong-key';

    expect(() => decrypt(ciphertext)).toThrowError(AiEncryptionError);
    expect(() => decrypt(ciphertext)).toThrowError('AI credential ciphertext is invalid');
  });

  it('rejects malformed and unsupported versioned values', () => {
    expect(() => decrypt('v1:not-valid-base64')).toThrowError(
      'AI credential ciphertext is invalid'
    );
    expect(() => decrypt('v2:whatever')).toThrowError(
      'AI credential ciphertext version is not supported'
    );
  });
});
