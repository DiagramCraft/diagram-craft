import { describe, expect, test } from 'vitest';
import { Vector } from './vector.ts';

describe('Vector', () => {
  test('negate', () => {
    expect(Vector.negate({ x: 1, y: 2 })).toStrictEqual({ x: -1, y: -2 });
  });

  test('scale', () => {
    expect(Vector.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });

  test('length', () => {
    expect(Vector.length({ x: 3, y: 4 })).toBe(5);
  });

  test('crossProduct', () => {
    expect(Vector.crossProduct({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(-2);
    expect(Vector.crossProduct({ x: 1, y: 2 }, { x: 2, y: 4 })).toBe(0);
  });

  test('fromPolar', () => {
    expect(Vector.round(Vector.fromPolar(Math.PI / 2, 1))).toStrictEqual({ x: 0, y: 1 });
  });

  test('scale', () => {
    expect(Vector.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });
});
