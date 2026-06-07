import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createLogger } from './logger';

const logger = createLogger('encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const getKey = (): Buffer | null => {
  const raw = process.env['AI_ENCRYPTION_KEY'];
  if (!raw) return null;
  return scryptSync(raw, 'arch-register-ai', 32);
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
