import { describe, expect, test } from 'vitest';
import { coalesce, isEmptyString, isSubsequence, padRight, shorten } from './strings';

describe('shorten', () => {
  test('should return the original string when it is shorter than the specified length', () => {
    expect(shorten('Hello', 10)).toBe('Hello');
  });

  test('should return the original string when it is equal to the specified length', () => {
    expect(shorten('Hello', 5)).toBe('Hello');
  });

  test('should return a shortened string appended with "..." when it is longer than the specified length', () => {
    expect(shorten('Hello, world!', 5)).toBe('Hello...');
  });

  test('should handle an empty string', () => {
    expect(shorten('', 5)).toBe('');
  });

  test('should return "..." when the specified length is 0', () => {
    expect(shorten('Hello', 0)).toBe('...');
  });

  test('should return the original string when the specified length is negative', () => {
    expect(shorten('Hello', -1)).toBe('Hello');
  });
});

describe('coalesce', () => {
  test('should return the first non-empty string', () => {
    expect(coalesce(undefined, 'Hello', 'World')).toBe('Hello');
  });

  test('should return undefined when all strings are undefined', () => {
    expect(coalesce(undefined, null, '')).toBeUndefined();
  });

  test('should return the first non-null string', () => {
    expect(coalesce(null, 'Hello', 'World')).toBe('Hello');
  });

  test('should return the first string that is not empty', () => {
    expect(coalesce('', 'Hello', 'World')).toBe('Hello');
  });

  test('should return undefined when all strings are null', () => {
    expect(coalesce(null, null, null)).toBeUndefined();
  });

  test('should return undefined when all strings are empty', () => {
    expect(coalesce('', '', '')).toBeUndefined();
  });
});

describe('padRight', () => {
  test('should pad the string to the required length with default spaces', () => {
    expect(padRight('Hello', 8)).toBe('Hello   ');
  });

  test('should return the original string if it is already equal to the target length', () => {
    expect(padRight('Hello', 5)).toBe('Hello');
  });

  test('should return the original string if it is longer than the target length', () => {
    expect(padRight('Hello, World!', 5)).toBe('Hello, World!');
  });

  test('should pad the string with a custom character', () => {
    expect(padRight('Hello', 10, '.')).toBe('Hello.....');
  });

  test('should pad the string with a custom multiple-character string', () => {
    expect(padRight('Hi', 8, '123')).toBe('Hi123123');
  });

  test('should handle an empty string and pad it to the target length', () => {
    expect(padRight('', 4)).toBe('    ');
  });

  test('should return the original string if the target length is less than or equal to 0', () => {
    expect(padRight('Hello', 0)).toBe('Hello');
  });
});

describe('isEmptyString', () => {
  test('should return true when the input is null', () => {
    expect(isEmptyString(null)).toBe(true);
  });

  test('should return true when the input is undefined', () => {
    expect(isEmptyString(undefined)).toBe(true);
  });

  test('should return true when the input is an empty string', () => {
    expect(isEmptyString('')).toBe(true);
  });

  test('should return true when the input is a string with only whitespace', () => {
    expect(isEmptyString('   ')).toBe(true);
  });

  test('should return false when the input is a non-empty string', () => {
    expect(isEmptyString('Hello')).toBe(false);
  });
});

describe('isSubsequence', () => {
  test('should return true when query is a subsequence of text', () => {
    expect(isSubsequence('lrm', 'lorem')).toBe(true);
    expect(isSubsequence('ipsm', 'ipsum')).toBe(true);
    expect(isSubsequence('ace', 'abcde')).toBe(true);
  });

  test('should return false when query is not a subsequence of text', () => {
    expect(isSubsequence('kalle', 'olle')).toBe(false);
    expect(isSubsequence('xyz', 'abcde')).toBe(false);
    expect(isSubsequence('cba', 'abc')).toBe(false);
  });

  test('should return true when query is empty', () => {
    expect(isSubsequence('', 'any text')).toBe(true);
    expect(isSubsequence('', '')).toBe(true);
  });

  test('should return false when text is empty but query is not', () => {
    expect(isSubsequence('a', '')).toBe(false);
    expect(isSubsequence('hello', '')).toBe(false);
  });

  test('should handle case sensitivity correctly', () => {
    expect(isSubsequence('abc', 'ABC')).toBe(false);
    expect(isSubsequence('ABC', 'abc')).toBe(false);
    expect(isSubsequence('abc', 'abc')).toBe(true);
  });

  test('should handle identical strings', () => {
    expect(isSubsequence('hello', 'hello')).toBe(true);
    expect(isSubsequence('test', 'test')).toBe(true);
  });

  test('should handle special characters and numbers', () => {
    expect(isSubsequence('13', '123456')).toBe(true);
    expect(isSubsequence('a@c', 'a@b@c')).toBe(true);
    expect(isSubsequence('!?', '!hello?')).toBe(true);
  });
});
