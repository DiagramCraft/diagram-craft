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

  describe('isCardinal', () => {
    test('returns true for 0 degrees (0 radians)', () => {
      expect(Angle.isCardinal(0)).toBe(true);
    });

    test('returns true for 90 degrees (PI/2 radians)', () => {
      expect(Angle.isCardinal(Math.PI / 2)).toBe(true);
    });

    test('returns true for 180 degrees (PI radians)', () => {
      expect(Angle.isCardinal(Math.PI)).toBe(true);
    });

    test('returns true for 270 degrees (3*PI/2 radians)', () => {
      expect(Angle.isCardinal((3 * Math.PI) / 2)).toBe(true);
    });

    test('returns false for 45 degrees', () => {
      expect(Angle.isCardinal(Math.PI / 4)).toBe(false);
    });

    test('returns false for 135 degrees', () => {
      expect(Angle.isCardinal((3 * Math.PI) / 4)).toBe(false);
    });

    test('returns false for 225 degrees', () => {
      expect(Angle.isCardinal((5 * Math.PI) / 4)).toBe(false);
    });

    test('returns false for 315 degrees', () => {
      expect(Angle.isCardinal((7 * Math.PI) / 4)).toBe(false);
    });

    test('returns false for arbitrary angles', () => {
      expect(Angle.isCardinal(1.5)).toBe(false);
      expect(Angle.isCardinal(2.0)).toBe(false);
      expect(Angle.isCardinal(0.1)).toBe(false);
    });

    test('handles angles slightly different from cardinal due to rounding', () => {
      expect(Angle.isCardinal(Math.PI / 2 + 0.0001)).toBe(true);
      expect(Angle.isCardinal(Math.PI - 0.0001)).toBe(true);
    });
  });

  describe('normalize', () => {
    test('normalize returns angle within 0 and 2*PI for positive input', () => {
      expect(Angle.normalize(3 * Math.PI)).toBe(Math.PI);
    });

    test('normalize returns angle within 0 and 2*PI for negative input', () => {
      expect(Angle.normalize(-Math.PI)).toBe(Math.PI);
    });

    test('normalize returns 0 for input 0', () => {
      expect(Angle.normalize(0)).toBe(0);
    });

    test('normalize returns correct value for large positive input', () => {
      expect(Angle.normalize(10 * Math.PI)).toBe(0);
    });

    test('normalize returns correct value for large negative input', () => {
      expect(Angle.normalize(-10 * Math.PI)).toBe(0);
    });
  });
});
