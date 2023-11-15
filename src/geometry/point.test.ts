import { describe, expect, test } from 'vitest';
import { Point } from './point.ts';

describe('Point', () => {
  test('adds two points', () => {
    expect(Point.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6 });
  });

  test('subtracts two points', () => {
    expect(Point.subtract({ x: 3, y: 4 }, { x: 1, y: 2 })).toStrictEqual({ x: 2, y: 2 });
  });

  test('midpoint of two points', () => {
    expect(Point.midpoint({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 2, y: 3 });
  });

  test('rotates point', () => {
    expect(Point.round(Point.rotate({ x: 1, y: 0 }, Math.PI / 2))).toStrictEqual({ x: 0, y: 1 });
  });
});
