import { describe, expect, test } from 'vitest';
import { Generators } from './generator';

describe('Generators.first', () => {
  test('should return the first value from a generator with multiple values', () => {
    function* numbers() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(Generators.first(numbers())).toBe(1);
  });

  test('should return undefined for an empty generator', () => {
    function* empty() {
      return;
    }
    expect(Generators.first(empty())).toBeUndefined();
  });

  test('should return the only value from a single-value generator', () => {
    function* single() {
      yield 42;
    }
    expect(Generators.first(single())).toBe(42);
  });
});
