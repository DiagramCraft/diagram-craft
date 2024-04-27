import { describe, expect, test } from 'vitest';
import { shorten } from './strings';

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
