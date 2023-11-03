import { expect, test, describe } from 'vitest';
import { Point, Box, Vector } from './geometry.ts';

describe('Vector', () => {
  test('negate', () => {
    expect(Vector.negate({ x: 1, y: 2 })).toStrictEqual({ x: -1, y: -2 });
  });

  test('scale', () => {
    expect(Vector.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });
});

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

  test('translates point', () => {
    expect(Point.translate({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6 });
  });

  test('rotates point', () => {
    expect(Point.round(Point.rotate({ x: 1, y: 0 }, Math.PI / 2))).toStrictEqual({ x: 0, y: 1 });
  });
});

describe('Box', () => {
  test('calculates center', () => {
    expect(Box.center({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } })).toStrictEqual({
      x: 5,
      y: 5
    });
  });

  test('calculates bounding box', () => {
    expect(
      Box.boundingBox([
        { pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } },
        { pos: { x: 5, y: 5 }, size: { w: 10, h: 10 } }
      ])
    ).toStrictEqual({ pos: { x: 0, y: 0 }, size: { w: 15, h: 15 } });
  });

  test('contains point', () => {
    expect(Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } }, { x: 5, y: 5 })).toBe(
      true
    );
  });

  test("doesn't contain point", () => {
    expect(Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } }, { x: 15, y: 15 })).toBe(
      false
    );
  });

  test('contains point with rotated box', () => {
    expect(
      Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 }, rotation: 45 }, { x: 0, y: 5 })
    ).toBe(true);
  });

  test("doesn't contains point with rotated box", () => {
    expect(
      Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 }, rotation: 45 }, { x: 0, y: 5.1 })
    ).toBe(true);
  });
});
