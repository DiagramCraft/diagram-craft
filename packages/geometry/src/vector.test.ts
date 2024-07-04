import { describe, expect, test } from 'vitest';
import { Vector } from './vector';

describe('Vector', () => {
  test('normalize', () => {
    expect(Vector.normalize({ x: 3, y: 4 })).toStrictEqual({ x: 0.6, y: 0.8 });
  });

  test('crossProduct', () => {
    expect(Vector.crossProduct({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(-2);
    expect(Vector.crossProduct({ x: 1, y: 2 }, { x: 2, y: 4 })).toBe(0);
  });

  test('angle', () => {
    expect(Vector.angle({ x: 1, y: 1 })).toBe(Math.PI / 4);
  });

  test('length', () => {
    expect(Vector.length({ x: 3, y: 4 })).toBe(5);
  });

  test('fromPolar', () => {
    expect(Vector.fromPolar(Math.PI / 2, 1).x).toBeCloseTo(0);
    expect(Vector.fromPolar(Math.PI / 2, 1).y).toBeCloseTo(1);
  });

  test('negate', () => {
    expect(Vector.negate({ x: 1, y: 2 })).toStrictEqual({ x: -1, y: -2 });
  });

  test('scale', () => {
    expect(Vector.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });

  test('scale', () => {
    expect(Vector.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });

  describe('tangentToNormal', () => {
    test('converts vector to its normal vector correctly', () => {
      expect(Vector.tangentToNormal({ x: 0, y: 1 })).toStrictEqual({ x: -1, y: 0 });
    });
  });

  describe('angleBetween', () => {
    test('calculates zero angle between identical vectors', () => {
      expect(Vector.angleBetween({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
    });

    test('calculates right angle between perpendicular vectors', () => {
      expect(Vector.angleBetween({ x: 0, y: 1 }, { x: 1, y: 0 })).toBeCloseTo(Math.PI / 2);
    });

    test('calculates correct angle between two arbitrary vectors', () => {
      expect(Vector.angleBetween({ x: 1, y: 1 }, { x: -1, y: 1 })).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('dotProduct', () => {
    test('calculates zero for perpendicular vectors', () => {
      expect(Vector.dotProduct({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    });

    test('calculates correct dot product for parallel vectors', () => {
      expect(Vector.dotProduct({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(4);
    });

    test('calculates correct dot product for arbitrary vectors', () => {
      expect(Vector.dotProduct({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
    });
  });
});
