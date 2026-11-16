import { describe, expect, test } from 'vitest';
import { installBuffer } from './installBuffer';

describe('installBuffer', () => {
  const Buf = installBuffer();

  test('encodes base64url without padding or +/ characters', () => {
    const bytes = Buf.from([0xfb, 0xff, 0xfe, 0x01]);
    expect(bytes.toString('base64')).toBe('+//+AQ==');
    expect(bytes.toString('base64url')).toBe('-__-AQ');
  });

  test('decodes base64url', () => {
    expect(Array.from(Buf.from('-__-AQ', 'base64url'))).toEqual([0xfb, 0xff, 0xfe, 0x01]);
  });

  test('keeps other encodings working', () => {
    expect(Buf.from('hello', 'utf8').toString('hex')).toBe('68656c6c6f');
    expect(Buf.from('hello').toString('utf8')).toBe('hello');
    expect(Buf.isEncoding('base64url')).toBe(true);
  });
});
