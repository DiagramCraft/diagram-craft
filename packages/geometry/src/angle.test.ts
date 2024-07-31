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
