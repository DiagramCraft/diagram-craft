import { describe, expect, test } from 'vitest';
import { isStringUnion } from './types';

describe('isEnum', () => {
  test('returns true for a valid enum value', () => {
    expect(isStringUnion('apple', ['apple', 'banana', 'cherry'])).toBe(true);
  });

  test('returns false for an invalid enum value', () => {
    expect(isStringUnion('orange', ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for a non-string value', () => {
    expect(isStringUnion(123, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for an empty string', () => {
    expect(isStringUnion('', ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for a null value', () => {
    expect(isStringUnion(null, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for an undefined value', () => {
    expect(isStringUnion(undefined, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns true for a valid enum value with mixed case', () => {
    expect(isStringUnion('Apple', ['Apple', 'Banana', 'Cherry'])).toBe(true);
  });

  test('returns false for a valid enum value with different case', () => {
    expect(isStringUnion('apple', ['Apple', 'Banana', 'Cherry'])).toBe(false);
  });
});
