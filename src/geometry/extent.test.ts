import { describe, expect, test } from 'vitest';
import { Extent } from './extent.ts';

describe('Extent', () => {
  test('isEqual', () => {
    expect(Extent.isEqual(Extent.of(1, 2), Extent.of(1, 2))).toBe(true);
    expect(Extent.isEqual(Extent.of(1, 2), Extent.of(1, 3))).toBe(false);
    expect(Extent.isEqual(Extent.of(1, 2), Extent.of(2, 2))).toBe(false);
  });
});
