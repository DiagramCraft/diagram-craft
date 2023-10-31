import { expect, test, describe } from 'vitest';
import { Coord, Box } from './geometry.ts';

describe('Coord', () => {
  test('adds two coords', () => {
    expect(Coord.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6 });
  });

  test('subtracts two coords', () => {
    expect(Coord.subtract({ x: 3, y: 4 }, { x: 1, y: 2 })).toStrictEqual({ x: 2, y: 2 });
  });

  test('midpoint of two coords', () => {
    expect(Coord.midpoint({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 2, y: 3 });
  });

  test('negates coord', () => {
    expect(Coord.negate({ x: 1, y: 2 })).toStrictEqual({ x: -1, y: -2 });
  });

  test('translates coord', () => {
    expect(Coord.translate({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6 });
  });

  test('scales coord', () => {
    expect(Coord.scale({ x: 1, y: 2 }, 2)).toStrictEqual({ x: 2, y: 4 });
  });

  test('rotates coord', () => {
    expect(Coord.round(Coord.rotate({ x: 1, y: 0 }, Math.PI / 2))).toStrictEqual({ x: 0, y: 1 });
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

  test('contains coord', () => {
    expect(Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } }, { x: 5, y: 5 })).toBe(
      true
    );
  });

  test("doesn't contain coord", () => {
    expect(Box.contains({ pos: { x: 0, y: 0 }, size: { w: 10, h: 10 } }, { x: 15, y: 15 })).toBe(
      false
    );
  });
});
