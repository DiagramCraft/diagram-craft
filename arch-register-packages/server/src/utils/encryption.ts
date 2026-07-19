import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const FALLBACK_SALT = 'arch-register-ai';
export const VERSIONED_CIPHERTEXT_PREFIX = 'v1:';

export type EncryptionErrorCode = 'missing-key' | 'invalid-ciphertext' | 'unsupported-version';

export class AiEncryptionError extends Error {
  constructor(
    public readonly code: EncryptionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AiEncryptionError';
  }
}

export type EncryptionKeyMaterial = {
  raw: string;
  salt: string;
  key: Buffer;
};

let cachedKey: EncryptionKeyMaterial | null = null;

const deriveKey = (raw: string, salt: string): EncryptionKeyMaterial => {
  if (cachedKey?.raw === raw && cachedKey.salt === salt) return cachedKey;
  const key = scryptSync(raw, salt, 32);
  cachedKey = { raw, salt, key };
  return cachedKey;
};

export const getEncryptionKeyMaterial = (
  keyEnv = 'AI_ENCRYPTION_KEY',
  saltEnv = 'AI_ENCRYPTION_SALT'
): EncryptionKeyMaterial | null => {
  const raw = process.env[keyEnv];
  if (!raw) return null;
  const salt = process.env[saltEnv] ?? FALLBACK_SALT;
  return deriveKey(raw, salt);
};

/**
 * Returns startup warning messages for missing AI encryption configuration.
 * Call this once at server startup and log each returned string as a warning.
 */
export const getEncryptionWarnings = (): string[] => {
  const warnings: string[] = [];
  if (!process.env['AI_ENCRYPTION_KEY']) {
    warnings.push(
      'AI_ENCRYPTION_KEY is not set — workspace AI API key writes are disabled; environment provider keys remain available'
    );
  }
  if (!process.env['AI_ENCRYPTION_SALT']) {
    warnings.push(
      'AI_ENCRYPTION_SALT is not set — falling back to default salt (not recommended for production deployments)'
    );
  }
  return warnings;
};

const decodePayload = (payload: string): Buffer => {
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new AiEncryptionError('invalid-ciphertext', 'AI credential ciphertext is invalid');
  }
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new AiEncryptionError('invalid-ciphertext', 'AI credential ciphertext is invalid');
  }
  return buf;
};

const encryptWithKeyMaterial = (plaintext: string, material: EncryptionKeyMaterial): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, material.key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSIONED_CIPHERTEXT_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
};

const decryptPayload = (payload: string, material: EncryptionKeyMaterial): string => {
  const buf = decodePayload(payload);
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  try {
    const decipher = createDecipheriv(ALGORITHM, material.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    throw new AiEncryptionError('invalid-ciphertext', 'AI credential ciphertext is invalid');
  }
};

export const encrypt = (plaintext: string): string => {
  const material = getEncryptionKeyMaterial();
  if (!material) {
    throw new AiEncryptionError(
      'missing-key',
      'AI_ENCRYPTION_KEY is required to store workspace AI credentials'
    );
  }
  return encryptWithKeyMaterial(plaintext, material);
};

export const decrypt = (storedValue: string): string => {
  if (!storedValue.startsWith(VERSIONED_CIPHERTEXT_PREFIX)) {
    if (storedValue.startsWith('v')) {
      throw new AiEncryptionError(
        'unsupported-version',
        'AI credential ciphertext version is not supported'
      );
    }
    return storedValue;
  }

  const material = getEncryptionKeyMaterial();
  if (!material) {
    throw new AiEncryptionError(
      'missing-key',
      'AI_ENCRYPTION_KEY is required to read workspace AI credentials'
    );
  }

  return decryptPayload(storedValue.slice(VERSIONED_CIPHERTEXT_PREFIX.length), material);
};

export const encryptWithKey = (plaintext: string, material: EncryptionKeyMaterial): string =>
  encryptWithKeyMaterial(plaintext, material);

export const decryptVersionedWithKey = (
  storedValue: string,
  material: EncryptionKeyMaterial
): string => {
  if (!storedValue.startsWith(VERSIONED_CIPHERTEXT_PREFIX)) {
    if (storedValue.startsWith('v')) {
      throw new AiEncryptionError(
        'unsupported-version',
        'AI credential ciphertext version is not supported'
      );
    }
    throw new AiEncryptionError('invalid-ciphertext', 'AI credential ciphertext is invalid');
  }
  return decryptPayload(storedValue.slice(VERSIONED_CIPHERTEXT_PREFIX.length), material);
};

export const decryptLegacyCiphertextWithKey = (
  storedValue: string,
  material: EncryptionKeyMaterial
): string => decryptPayload(storedValue, material);
