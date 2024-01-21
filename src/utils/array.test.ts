import { describe, expect, test } from 'vitest';
import { range, smallest } from './array.ts';

describe('smallest', () => {
  test('should return the smallest number in an array', () => {
    expect(smallest([3, 1, 4], (a, b) => a - b)).toBe(1);
  });

  test('should return undefined for an empty array', () => {
    expect(smallest([], (a, b) => a - b)).toBeUndefined();
  });

  test('should return the smallest string in an array', () => {
    expect(smallest(['apple', 'banana', 'cherry'], (a, b) => a.localeCompare(b))).toBe('apple');
  });

  test('should handle arrays with one element', () => {
    expect(smallest([42], (a, b) => a - b)).toBe(42);
  });
});

describe('range', () => {
  test('should generate an array of numbers within a specified range', () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  test('should return an empty array when start and end are the same', () => {
    expect(range(2, 2)).toEqual([]);
  });

  test('should return an array with a single element when end is one more than start', () => {
    expect(range(2, 3)).toEqual([2]);
  });
});
