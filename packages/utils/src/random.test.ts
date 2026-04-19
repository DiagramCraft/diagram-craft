import { describe, expect, it } from 'vitest';
import { Random } from './random';
import type { NoneEmptyArray } from './types';

describe('Random', () => {
  it('generates consistent float values with the same seed', () => {
    const random1 = new Random(12345);
    const random2 = new Random(12345);
    expect(random1.nextFloat()).toBe(random2.nextFloat());
  });

  it('generates different float values with different seeds', () => {
    const random1 = new Random(12345);
    const random2 = new Random(54321);
    expect(random1.nextFloat()).not.toBe(random2.nextFloat());
  });

  it('generates float values between 0 and 1', () => {
    const random = new Random(12345);
    const value = random.nextFloat();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('generates values within specified range', () => {
    const random = new Random(12345);
    const value = random.nextRange(10, 20);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
  });

  it('generates boolean values', () => {
    const random = new Random(12345);
    const value = random.nextBoolean();
    expect(typeof value).toBe('boolean');
  });

  it('generates different sequences with different seeds', () => {
    const random1 = new Random(12345);
    const random2 = new Random(54321);
    const sequence1 = [random1.nextFloat(), random1.nextFloat(), random1.nextFloat()];
    const sequence2 = [random2.nextFloat(), random2.nextFloat(), random2.nextFloat()];
    expect(sequence1).not.toEqual(sequence2);
  });

  it('generates consistent sequences with the same seed', () => {
    const random1 = new Random(12345);
    const random2 = new Random(12345);
    const sequence1 = [random1.nextFloat(), random1.nextFloat(), random1.nextFloat()];
    const sequence2 = [random2.nextFloat(), random2.nextFloat(), random2.nextFloat()];
    expect(sequence1).toEqual(sequence2);
  });

  describe('pick', () => {
    it('returns an element from the provided array', () => {
      const random = new Random(12345);
      const array: NoneEmptyArray<number> = [1, 2, 3, 4, 5];
      const result = random.pick(array);
      expect(array).toContain(result);
    });

    it('returns the same element with the same seed', () => {
      const random1 = new Random(12345);
      const random2 = new Random(12345);
      const array: NoneEmptyArray<number> = [1, 2, 3, 4, 5];
      expect(random1.pick(array)).toBe(random2.pick(array));
    });

    it('works with arrays of different types', () => {
      const random = new Random(12345);

      // Test with array of numbers
      const numArray: NoneEmptyArray<number> = [1, 2, 3, 4, 5];
      expect(typeof random.pick(numArray)).toBe('number');

      // Test with array of strings
      const strArray: NoneEmptyArray<string> = ['a', 'b', 'c', 'd', 'e'];
      expect(typeof random.pick(strArray)).toBe('string');

      // Test with array of objects
      const objArray: NoneEmptyArray<{ id: number }> = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = random.pick(objArray);
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('id');
    });

    it('works with arrays of different lengths', () => {
      const random = new Random(12345);

      // Test with short array
      const shortArray: NoneEmptyArray<number> = [1, 2];
      expect(shortArray).toContain(random.pick(shortArray));

      // Test with longer array
      const longArray = Array.from({ length: 100 }, (_, i) => i) as NoneEmptyArray<number>;
      expect(longArray).toContain(random.pick(longArray));
    });

    it('always returns the same element with array of length 1', () => {
      const random = new Random(12345);
      const array: NoneEmptyArray<number> = [42];
      expect(random.pick(array)).toBe(42);
      expect(random.pick(array)).toBe(42);
      expect(random.pick(array)).toBe(42);
    });

    it('throws with empty array', () => {
      const random = new Random(12345);
      const emptyArray = [] as unknown as NoneEmptyArray<number>;
      expect(() => random.pick(emptyArray)).toThrowError('array has at least one element');
    });
  });
});
