import { describe, expect, test } from 'vitest';
import { assertFullDirectionOrUndefined, Direction } from './direction';

describe('Direction', () => {
  test('opposite', () => {
    expect(Direction.opposite('n')).toBe('s');
    expect(Direction.opposite('s')).toBe('n');
    expect(Direction.opposite('w')).toBe('e');
    expect(Direction.opposite('e')).toBe('w');
  });

  test('all', () => {
    expect(Direction.all()).toStrictEqual(['n', 's', 'w', 'e']);
  });

  describe('fromVector', () => {
    test('should return north when y is negative and abs(y) > abs(x)', () => {
      expect(Direction.fromVector({ x: 0, y: -10 })).toBe('n');
      expect(Direction.fromVector({ x: 5, y: -10 })).toBe('n');
      expect(Direction.fromVector({ x: -5, y: -10 })).toBe('n');
    });

    test('should return south when y is positive and abs(y) > abs(x)', () => {
      expect(Direction.fromVector({ x: 0, y: 10 })).toBe('s');
      expect(Direction.fromVector({ x: 5, y: 10 })).toBe('s');
      expect(Direction.fromVector({ x: -5, y: 10 })).toBe('s');
    });

    test('should return east when x is positive and abs(x) > abs(y)', () => {
      expect(Direction.fromVector({ x: 10, y: 0 })).toBe('e');
      expect(Direction.fromVector({ x: 10, y: 5 })).toBe('e');
      expect(Direction.fromVector({ x: 10, y: -5 })).toBe('e');
    });

    test('should return west when x is negative and abs(x) > abs(y)', () => {
      expect(Direction.fromVector({ x: -10, y: 0 })).toBe('w');
      expect(Direction.fromVector({ x: -10, y: 5 })).toBe('w');
      expect(Direction.fromVector({ x: -10, y: -5 })).toBe('w');
    });

    test('should handle edge cases where abs(x) = abs(y)', () => {
      // When abs(x) = abs(y), the function prioritizes y direction
      expect(Direction.fromVector({ x: 10, y: 10 })).toBe('s');
      expect(Direction.fromVector({ x: -10, y: 10 })).toBe('s');
      expect(Direction.fromVector({ x: 10, y: -10 })).toBe('n');
      expect(Direction.fromVector({ x: -10, y: -10 })).toBe('n');
    });
  });

  describe('fromAngle', () => {
    test('should return north for angles between PI/4 and 3PI/4', () => {
      expect(Direction.fromAngle(Math.PI / 3)).toBe('n');
      expect(Direction.fromAngle(Math.PI / 2)).toBe('n');
      expect(Direction.fromAngle((2 * Math.PI) / 3)).toBe('n');
    });

    test('should return west for angles between 3PI/4 and 5PI/4', () => {
      expect(Direction.fromAngle(Math.PI)).toBe('w');
      expect(Direction.fromAngle((4 * Math.PI) / 5)).toBe('w');
      expect(Direction.fromAngle((6 * Math.PI) / 5)).toBe('w');
    });

    test('should return south for angles between 5PI/4 and 7PI/4', () => {
      expect(Direction.fromAngle((3 * Math.PI) / 2)).toBe('s');
      expect(Direction.fromAngle((5 * Math.PI) / 3)).toBe('s');
      expect(Direction.fromAngle((6.8 * Math.PI) / 4)).toBe('s'); // Just under 7PI/4
    });

    test('should return east for angles between 7PI/4 and PI/4', () => {
      expect(Direction.fromAngle(0)).toBe('e');
      expect(Direction.fromAngle(Math.PI / 6)).toBe('e');
      expect(Direction.fromAngle((7 * Math.PI) / 4)).toBe('e');
      expect(Direction.fromAngle(2 * Math.PI - 0.1)).toBe('e');
    });

    test('should normalize angles outside the 0-2PI range', () => {
      expect(Direction.fromAngle(-Math.PI / 2)).toBe('s'); // -PI/2 normalizes to 3PI/2
      expect(Direction.fromAngle((5 * Math.PI) / 2)).toBe('n'); // 5PI/2 normalizes to PI/2
    });

    test('should handle inverted parameter', () => {
      expect(Direction.fromAngle(Math.PI / 2, true)).toBe('s');
      expect(Direction.fromAngle((3 * Math.PI) / 2, true)).toBe('n');
    });
  });

  describe('toAngle', () => {
    test('should convert north to PI/2', () => {
      expect(Direction.toAngle('n')).toBe(Math.PI / 2);
    });

    test('should convert south to 3PI/2', () => {
      expect(Direction.toAngle('s')).toBe((3 * Math.PI) / 2);
    });

    test('should convert west to PI', () => {
      expect(Direction.toAngle('w')).toBe(Math.PI);
    });

    test('should convert east to 0', () => {
      expect(Direction.toAngle('e')).toBe(0);
    });

    test('should handle inverted parameter', () => {
      expect(Direction.toAngle('n', true)).toBe((3 * Math.PI) / 2);
      expect(Direction.toAngle('s', true)).toBe(Math.PI / 2);
      expect(Direction.toAngle('w', true)).toBe(Math.PI); // Same as non-inverted
      expect(Direction.toAngle('e', true)).toBe(0); // Same as non-inverted
    });
  });
});

describe('assertFullDirectionOrUndefined', () => {
  test('should not throw for valid full directions', () => {
    expect(() => assertFullDirectionOrUndefined('north')).not.toThrow();
    expect(() => assertFullDirectionOrUndefined('south')).not.toThrow();
    expect(() => assertFullDirectionOrUndefined('east')).not.toThrow();
    expect(() => assertFullDirectionOrUndefined('west')).not.toThrow();
  });

  test('should not throw for undefined', () => {
    expect(() => assertFullDirectionOrUndefined(undefined)).not.toThrow();
  });

  test('should throw for invalid directions', () => {
    expect(() => assertFullDirectionOrUndefined('invalid')).toThrow('Invalid direction: invalid');
    expect(() => assertFullDirectionOrUndefined('n')).toThrow('Invalid direction: n');
    expect(() => assertFullDirectionOrUndefined('')).toThrow('Invalid direction: ');
  });
});
