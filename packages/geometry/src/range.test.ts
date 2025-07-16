import { describe, expect, test } from 'vitest';
import { Range } from './range';

describe('Range', () => {
  test('of', () => {
    // Basic range creation
    expect(Range.of(1, 2)).toStrictEqual([1, 2]);

    // Range with negative numbers
    expect(Range.of(-2, -1)).toStrictEqual([-2, -1]);

    // Range with same start and end
    expect(Range.of(5, 5)).toStrictEqual([5, 5]);

    // Range with inverted order (this is allowed by the implementation)
    expect(Range.of(10, 5)).toStrictEqual([10, 5]);
  });

  test('overlaps', () => {
    // Basic overlap cases
    expect(Range.overlaps(Range.of(1, 3), Range.of(2, 4))).toBe(true);
    expect(Range.overlaps(Range.of(1, 2), Range.of(3, 4))).toBe(false);

    // Edge cases
    // Ranges touch at a single point
    expect(Range.overlaps(Range.of(1, 2), Range.of(2, 3))).toBe(true);
    expect(Range.overlaps(Range.of(2, 3), Range.of(1, 2))).toBe(true);

    // One range contains the other
    expect(Range.overlaps(Range.of(1, 5), Range.of(2, 3))).toBe(true);
    expect(Range.overlaps(Range.of(2, 3), Range.of(1, 5))).toBe(true);

    // Identical ranges
    expect(Range.overlaps(Range.of(1, 2), Range.of(1, 2))).toBe(true);

    // Ranges with negative numbers
    expect(Range.overlaps(Range.of(-3, -1), Range.of(-2, 0))).toBe(true);
    expect(Range.overlaps(Range.of(-3, -2), Range.of(-1, 0))).toBe(false);

    // Zero-length ranges (start = end)
    expect(Range.overlaps(Range.of(2, 2), Range.of(2, 3))).toBe(true);
    expect(Range.overlaps(Range.of(1, 2), Range.of(2, 2))).toBe(true);
    expect(Range.overlaps(Range.of(1, 1), Range.of(2, 2))).toBe(false);
  });

  test('intersection', () => {
    // Basic intersection cases
    expect(Range.intersection(Range.of(1, 3), Range.of(2, 4))).toStrictEqual(Range.of(2, 3));
    expect(Range.intersection(Range.of(1, 2), Range.of(3, 4))).toBe(undefined);

    // Edge cases
    // Ranges touch at a single point
    expect(Range.intersection(Range.of(1, 2), Range.of(2, 3))).toStrictEqual(Range.of(2, 2));

    // One range contains the other
    expect(Range.intersection(Range.of(1, 5), Range.of(2, 3))).toStrictEqual(Range.of(2, 3));
    expect(Range.intersection(Range.of(2, 3), Range.of(1, 5))).toStrictEqual(Range.of(2, 3));

    // Identical ranges
    expect(Range.intersection(Range.of(1, 2), Range.of(1, 2))).toStrictEqual(Range.of(1, 2));

    // Ranges with negative numbers
    expect(Range.intersection(Range.of(-3, -1), Range.of(-2, 0))).toStrictEqual(Range.of(-2, -1));

    // Zero-length ranges (start = end)
    expect(Range.intersection(Range.of(2, 2), Range.of(2, 3))).toStrictEqual(Range.of(2, 2));
    expect(Range.intersection(Range.of(1, 2), Range.of(2, 2))).toStrictEqual(Range.of(2, 2));
  });

  test('midpoint', () => {
    // Basic midpoint cases
    expect(Range.midpoint(Range.of(1, 3))).toBe(2);
    expect(Range.midpoint(Range.of(1, 2))).toBe(1.5);

    // Edge cases
    // Range with same start and end
    expect(Range.midpoint(Range.of(5, 5))).toBe(5);

    // Range with negative numbers
    expect(Range.midpoint(Range.of(-3, -1))).toBe(-2);
    expect(Range.midpoint(Range.of(-2, 2))).toBe(0);

    // Range with decimal numbers
    expect(Range.midpoint(Range.of(1.5, 3.5))).toBe(2.5);
  });

  test('add', () => {
    // Basic add cases
    expect(Range.add(Range.of(1, 2), 1)).toStrictEqual(Range.of(2, 3));

    // Edge cases
    // Adding zero
    expect(Range.add(Range.of(1, 2), 0)).toStrictEqual(Range.of(1, 2));

    // Adding negative number
    expect(Range.add(Range.of(1, 2), -1)).toStrictEqual(Range.of(0, 1));

    // Adding to range with negative numbers
    expect(Range.add(Range.of(-3, -1), 2)).toStrictEqual(Range.of(-1, 1));

    // Adding to zero-length range
    expect(Range.add(Range.of(5, 5), 3)).toStrictEqual(Range.of(8, 8));
  });

  test('contains', () => {
    // Basic contains cases
    expect(Range.contains(Range.of(1, 3), 2)).toBe(true);
    expect(Range.contains(Range.of(1, 3), 0)).toBe(false);
    expect(Range.contains(Range.of(1, 3), 4)).toBe(false);

    // Edge cases
    // Value at range boundaries
    expect(Range.contains(Range.of(1, 3), 1)).toBe(true);
    expect(Range.contains(Range.of(1, 3), 3)).toBe(true);

    // Range with negative numbers
    expect(Range.contains(Range.of(-3, -1), -2)).toBe(true);
    expect(Range.contains(Range.of(-3, -1), 0)).toBe(false);

    // Zero-length range
    expect(Range.contains(Range.of(5, 5), 5)).toBe(true);
    expect(Range.contains(Range.of(5, 5), 4)).toBe(false);

    // Inverted range (this behavior depends on the implementation)
    expect(Range.contains(Range.of(3, 1), 2)).toBe(false);
  });

  test('length', () => {
    // Basic length cases
    expect(Range.length(Range.of(1, 3))).toBe(2);
    expect(Range.length(Range.of(0, 10))).toBe(10);

    // Edge cases
    // Zero-length range
    expect(Range.length(Range.of(5, 5))).toBe(0);

    // Range with negative numbers
    expect(Range.length(Range.of(-3, -1))).toBe(2);
    expect(Range.length(Range.of(-5, 5))).toBe(10);

    // Inverted range
    expect(Range.length(Range.of(3, 1))).toBe(2);
  });

  test('isValid', () => {
    // Basic isValid cases
    expect(Range.isValid(Range.of(1, 3))).toBe(true);
    expect(Range.isValid(Range.of(3, 1))).toBe(false);

    // Edge cases
    // Zero-length range
    expect(Range.isValid(Range.of(5, 5))).toBe(true);

    // Range with negative numbers
    expect(Range.isValid(Range.of(-3, -1))).toBe(true);
    expect(Range.isValid(Range.of(-1, -3))).toBe(false);
  });

  test('normalize', () => {
    // Basic normalize cases
    expect(Range.normalize(Range.of(1, 3))).toStrictEqual(Range.of(1, 3));
    expect(Range.normalize(Range.of(3, 1))).toStrictEqual(Range.of(1, 3));

    // Edge cases
    // Zero-length range
    expect(Range.normalize(Range.of(5, 5))).toStrictEqual(Range.of(5, 5));

    // Range with negative numbers
    expect(Range.normalize(Range.of(-3, -1))).toStrictEqual(Range.of(-3, -1));
    expect(Range.normalize(Range.of(-1, -3))).toStrictEqual(Range.of(-3, -1));
  });

  test('scale', () => {
    // Basic scale cases
    expect(Range.scale(Range.of(0, 10), 2)).toStrictEqual(Range.of(-5, 15));
    expect(Range.scale(Range.of(0, 10), 0.5)).toStrictEqual(Range.of(2.5, 7.5));

    // Edge cases
    // Zero-length range
    expect(Range.scale(Range.of(5, 5), 2)).toStrictEqual(Range.of(5, 5));

    // Range with negative numbers
    expect(Range.scale(Range.of(-3, 1), 2)).toStrictEqual(Range.of(-5, 3));

    // Scale by zero
    expect(Range.scale(Range.of(0, 10), 0)).toStrictEqual(Range.of(5, 5));

    // Scale by negative number
    expect(Range.scale(Range.of(0, 10), -1)).toStrictEqual(Range.of(10, 0));
  });

  test('clamp', () => {
    // Basic clamp cases
    expect(Range.clamp(Range.of(1, 3), 2)).toBe(2);
    expect(Range.clamp(Range.of(1, 3), 0)).toBe(1);
    expect(Range.clamp(Range.of(1, 3), 4)).toBe(3);

    // Edge cases
    // Value at range boundaries
    expect(Range.clamp(Range.of(1, 3), 1)).toBe(1);
    expect(Range.clamp(Range.of(1, 3), 3)).toBe(3);

    // Range with negative numbers
    expect(Range.clamp(Range.of(-3, -1), -2)).toBe(-2);
    expect(Range.clamp(Range.of(-3, -1), 0)).toBe(-1);
    expect(Range.clamp(Range.of(-3, -1), -4)).toBe(-3);

    // Zero-length range
    expect(Range.clamp(Range.of(5, 5), 5)).toBe(5);
    expect(Range.clamp(Range.of(5, 5), 4)).toBe(5);
    expect(Range.clamp(Range.of(5, 5), 6)).toBe(5);

    // Inverted range (this behavior depends on the implementation)
    // For inverted ranges, clamp should work with the normalized range
    expect(Range.clamp(Range.of(3, 1), 2)).toBe(2);
  });
});
