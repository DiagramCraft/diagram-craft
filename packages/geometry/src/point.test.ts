import { describe, expect, test } from 'vitest';
import { Point } from './point';

describe('Point', () => {
  test('of', () => {
    expect(Point.of(1, 2)).toStrictEqual({ x: 1, y: 2 });
  });

  test('ofTuple', () => {
    expect(Point.ofTuple([1, 2])).toStrictEqual({ x: 1, y: 2 });
  });

  test('add', () => {
    expect(Point.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6 });
  });

  test('subtract', () => {
    expect(Point.subtract({ x: 3, y: 4 }, { x: 1, y: 2 })).toStrictEqual({ x: 2, y: 2 });
  });

  test('midpoint', () => {
    expect(Point.midpoint({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 2, y: 3 });
  });

  test('rotate', () => {
    expect(Point.rotate({ x: 1, y: 0 }, Math.PI / 2).x).toBeCloseTo(0);
    expect(Point.rotate({ x: 1, y: 0 }, Math.PI / 2).y).toBeCloseTo(1);
  });

  test('rotateAround', () => {
    expect(Point.rotateAround({ x: 1, y: 0 }, Math.PI / 2, { x: 1, y: 0 }).x).toBeCloseTo(1);
    expect(Point.rotateAround({ x: 1, y: 0 }, Math.PI / 2, { x: 1, y: 0 }).y).toBeCloseTo(0);
  });

  test('isEqual', () => {
    expect(Point.isEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(Point.isEqual({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
    expect(Point.isEqual({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  test('squareDistance', () => {
    expect(Point.squareDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(2);
  });

  test('distance', () => {
    expect(Point.distance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.sqrt(2));
  });
});
