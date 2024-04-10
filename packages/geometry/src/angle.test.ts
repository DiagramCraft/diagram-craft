import { describe, expect, test } from 'vitest';
import { Angle } from './angle';

describe('Angle', () => {
  test('toDeg', () => {
    expect(Angle.toDeg(Math.PI)).toBe(180);
  });
  test('toRad', () => {
    expect(Angle.toRad(180)).toBe(Math.PI);
  });
  test('isVertical', () => {
    expect(Angle.isVertical(Math.PI / 2)).toBe(true);
    expect(Angle.isVertical((3 * Math.PI) / 2)).toBe(true);
  });
  test('isHorizontal', () => {
    expect(Angle.isHorizontal(0)).toBe(true);
    expect(Angle.isHorizontal(Math.PI)).toBe(true);
  });
});
