import * as nodeCrypto from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createHash, createHmac, randomBytes, randomUUID } from './nodeCrypto';

// The stub must produce exactly what node:crypto does for the algorithms the server uses

describe('nodeCrypto stub', () => {
  for (const algorithm of ['sha1', 'sha256']) {
    test(`createHash(${algorithm}) matches node:crypto`, () => {
      const input = 'workspace:schema – ünïcode';
      expect(createHash(algorithm).update(input).digest('hex')).toBe(
        nodeCrypto.createHash(algorithm).update(input).digest('hex')
      );
      expect([...(createHash(algorithm).update(input).digest() as Uint8Array)]).toEqual([
        ...nodeCrypto.createHash(algorithm).update(input).digest()
      ]);
    });
  }

  test('createHash supports chained updates and binary input', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    expect(createHash('sha256').update('a').update(bytes).digest('hex')).toBe(
      nodeCrypto.createHash('sha256').update('a').update(bytes).digest('hex')
    );
  });

  test('createHmac(sha256) matches node:crypto', () => {
    expect(createHmac('sha256', 'secret').update('body').digest('hex')).toBe(
      nodeCrypto.createHmac('sha256', 'secret').update('body').digest('hex')
    );
  });

  test('rejects unsupported algorithms', () => {
    expect(() => createHash('md5')).toThrow(/not supported/);
  });

  test('random helpers', () => {
    expect(randomBytes(16)).toHaveLength(16);
    expect(randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
