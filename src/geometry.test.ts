import { describe, expect, test } from 'vitest';
import { Angle, Box, Point, Rotation, Transform, TransformFactory, Vector } from './geometry.ts';

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

describe('Rotate', () => {
  test('rotate point', () => {
    let p1: Point = { x: -10, y: -10 };
    let p2: Point = { x: 10, y: 10 };

    p1 = new Rotation(Angle.toRad(90)).apply(p1);
    p2 = new Rotation(Angle.toRad(90)).apply(p2);

    expect(p1).toStrictEqual({ x: 10, y: -10 });
    expect(p2).toStrictEqual({ x: -10, y: 10 });
  });

  test('rotate box', () => {
    let b1: Box = { pos: { x: -10, y: -10 }, size: { w: 10, h: 10 } };
    let b2: Box = { pos: { x: 10, y: 10 }, size: { w: 10, h: 10 } };

    b1 = new Rotation(Angle.toRad(90)).apply(b1);
    b2 = new Rotation(Angle.toRad(90)).apply(b2);

    expect(Point.round(b1.pos)).toStrictEqual({ x: 0, y: -10 });
    expect(Point.round(b2.pos)).toStrictEqual({ x: -20, y: 10 });
  });
});

describe('TransformationFactory', () => {
  test('rotate', () => {
    let node1: Box = {
      pos: { x: 0, y: 0 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    let node2: Box = {
      pos: { x: 100, y: 100 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    const before = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: 0 };
    const after = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: 90 };

    node1 = Transform.box(node1, ...TransformFactory.fromTo(before, after));
    node2 = Transform.box(node2, ...TransformFactory.fromTo(before, after));

    expect(node1.rotation).toStrictEqual(90);
    expect(node1.pos).toStrictEqual({ x: 100, y: 0 });
    expect(node1.size).toStrictEqual({ w: 100, h: 100 });

    expect(node2.rotation).toStrictEqual(90);
    expect(node2.pos).toStrictEqual({ x: 0, y: 100 });
    expect(node2.size).toStrictEqual({ w: 100, h: 100 });
  });
});
