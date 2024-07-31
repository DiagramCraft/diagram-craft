import { describe, expect, test } from 'vitest';
import { isEnum } from './types';

describe('isEnum', () => {
  test('returns true for a valid enum value', () => {
    expect(isEnum('apple', ['apple', 'banana', 'cherry'])).toBe(true);
  });

  test('returns false for an invalid enum value', () => {
    expect(isEnum('orange', ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for a non-string value', () => {
    expect(isEnum(123, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for an empty string', () => {
    expect(isEnum('', ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for a null value', () => {
    expect(isEnum(null, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns false for an undefined value', () => {
    expect(isEnum(undefined, ['apple', 'banana', 'cherry'])).toBe(false);
  });

  test('returns true for a valid enum value with mixed case', () => {
    expect(isEnum('Apple', ['Apple', 'Banana', 'Cherry'])).toBe(true);
  });

  test('returns false for a valid enum value with different case', () => {
    expect(isEnum('apple', ['Apple', 'Banana', 'Cherry'])).toBe(false);
  });
});
