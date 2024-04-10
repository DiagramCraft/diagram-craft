import { describe, expect, test } from 'vitest';
import {
  groupBy,
  hasElements,
  hasSameElements,
  isEmpty,
  largest,
  range,
  smallest,
  smallestIndex,
  unique
} from './array';

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

describe('smallestIndex', () => {
  test('should return the index of the smallest number in an array', () => {
    expect(smallestIndex([3, 1, 4])).toBe(1);
  });

  test('should return 0 for an array with one element', () => {
    expect(smallestIndex([42])).toBe(0);
  });

  test('should return 0 for an array with all elements being the same', () => {
    expect(smallestIndex([2, 2, 2])).toBe(0);
  });

  test('should return the first index of the smallest number when there are duplicates', () => {
    expect(smallestIndex([3, 1, 4, 1])).toBe(1);
  });
});

describe('largest', () => {
  test('should return the largest number in an array', () => {
    expect(largest([3, 1, 4], (a, b) => a - b)).toBe(4);
  });

  test('should return undefined for an empty array', () => {
    expect(largest([], (a, b) => a - b)).toBeUndefined();
  });

  test('should return the largest string in an array', () => {
    expect(largest(['apple', 'banana', 'cherry'], (a, b) => a.localeCompare(b))).toBe('cherry');
  });

  test('should handle arrays with one element', () => {
    expect(largest([42], (a, b) => a - b)).toBe(42);
  });
});

describe('unique', () => {
  test('should return a new array with duplicates removed', () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  test('should return an empty array when input is an empty array', () => {
    expect(unique([])).toEqual([]);
  });

  test('should handle arrays with one element', () => {
    expect(unique([42])).toEqual([42]);
  });

  test('should remove duplicates based on the return value of respectTo', () => {
    expect(unique([{ id: 1 }, { id: 2 }, { id: 2 }], e => e.id)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('groupBy', () => {
  test('should group the elements of an array by the return value of respectTo', () => {
    expect(groupBy(['apple', 'banana', 'cherry'], e => e[0])).toEqual(
      new Map([
        ['a', ['apple']],
        ['b', ['banana']],
        ['c', ['cherry']]
      ])
    );
  });

  test('should return an empty Map when input is an empty array', () => {
    expect(groupBy([], e => e)).toEqual(new Map());
  });

  test('should handle arrays with one element', () => {
    expect(groupBy([42], e => e)).toEqual(new Map([[42, [42]]]));
  });

  test('should group elements with the same key into the same array', () => {
    expect(groupBy(['apple', 'avocado', 'banana', 'berry'], e => e[0])).toEqual(
      new Map([
        ['a', ['apple', 'avocado']],
        ['b', ['banana', 'berry']]
      ])
    );
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

describe('hasSameElements', () => {
  test('should return true for two identical arrays', () => {
    expect(hasSameElements([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  test('should return true for two arrays with the same elements in different order', () => {
    expect(hasSameElements([1, 2, 3], [3, 2, 1])).toBe(true);
  });

  test('should return false for two arrays with different elements', () => {
    expect(hasSameElements([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  test('should return false for two arrays with different lengths', () => {
    expect(hasSameElements([1, 2, 3], [1, 2])).toBe(false);
  });

  test('should return true for two empty arrays', () => {
    expect(hasSameElements([], [])).toBe(true);
  });

  test('should return false for an empty array and a non-empty array', () => {
    expect(hasSameElements([], [1, 2, 3])).toBe(false);
  });
});

describe('isEmpty', () => {
  test('should return true for an empty array', () => {
    expect(isEmpty([])).toBe(true);
  });

  test('should return false for a non-empty array', () => {
    expect(isEmpty([1, 2, 3])).toBe(false);
  });

  test('should return true for null', () => {
    expect(isEmpty(null)).toBe(true);
  });

  test('should return true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true);
  });
});

describe('hasElements', () => {
  test('should return true for a non-empty array', () => {
    expect(hasElements([1, 2, 3])).toBe(true);
  });

  test('should return false for an empty array', () => {
    expect(hasElements([])).toBe(false);
  });

  test('should return false for null', () => {
    expect(hasElements(null)).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(hasElements(undefined)).toBe(false);
  });
});
