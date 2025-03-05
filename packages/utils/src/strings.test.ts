import { describe, expect, test } from 'vitest';
import { coalesce, isEmptyString, shorten } from './strings';

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
