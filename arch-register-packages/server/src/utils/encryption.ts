import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createLogger } from './logger';

const logger = createLogger('encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const FALLBACK_SALT = 'arch-register-ai';

const getKey = (): Buffer | null => {
  const raw = process.env['AI_ENCRYPTION_KEY'];
  if (!raw) return null;
  const salt = process.env['AI_ENCRYPTION_SALT'] ?? FALLBACK_SALT;
  return scryptSync(raw, salt, 32);
};

/**
 * Returns startup warning messages for missing AI encryption configuration.
 * Call this once at server startup and log each returned string as a warning.
 */
export const getEncryptionWarnings = (): string[] => {
  const warnings: string[] = [];
  if (!process.env['AI_ENCRYPTION_KEY']) {
    warnings.push(
      'AI_ENCRYPTION_KEY is not set — AI provider API keys will be stored as plaintext in the database'
    );
  }
  if (!process.env['AI_ENCRYPTION_SALT']) {
    warnings.push(
      'AI_ENCRYPTION_SALT is not set — falling back to default salt (not recommended for production deployments)'
    );
  }
  return warnings;
};

export const encrypt = (plaintext: string): string => {
  const key = getKey();
  if (!key) {
    logger.warn('AI_ENCRYPTION_KEY not set — storing API key as plaintext');
    return plaintext;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

export const decrypt = (ciphertext: string): string => {
  const key = getKey();
  if (!key) return ciphertext;
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) return ciphertext;
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
};
