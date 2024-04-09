import { describe, expect, test } from 'vitest';
import { Vector } from './vector.ts';

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
});
