import { describe, expect, test } from 'vitest';
import { Range } from './range';

describe('Range', () => {
  test('overlaps', () => {
    expect(Range.overlaps(Range.of(1, 2), Range.of(2, 3))).toBe(true);
    expect(Range.overlaps(Range.of(1, 2), Range.of(3, 4))).toBe(false);
  });

  test('intersection', () => {
    expect(Range.intersection(Range.of(1, 2), Range.of(2, 3))).toStrictEqual(Range.of(2, 2));
    expect(Range.intersection(Range.of(1, 2), Range.of(3, 4))).toBe(undefined);
  });

  test('midpoint', () => {
    expect(Range.midpoint(Range.of(1, 2))).toBe(1.5);
  });

  test('add', () => {
    expect(Range.add(Range.of(1, 2), 1)).toStrictEqual(Range.of(2, 3));
  });
});
