import { describe, expect, test } from 'vitest';
import { Box } from './box.ts';
import { Rotation, Transform, TransformFactory } from './transform.ts';
import { Point } from './point.ts';

describe('TransformationFactory', () => {
  test('rotate', () => {
    let node1: Box = {
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      r: 0
    };

    let node2: Box = {
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      r: 0
    };

    const before = { x: 0, y: 0, w: 200, h: 200, r: 0 };
    const after = { x: 0, y: 0, w: 200, h: 200, r: Math.PI / 2 };

    node1 = Transform.box(node1, ...TransformFactory.fromTo(before, after));
    node2 = Transform.box(node2, ...TransformFactory.fromTo(before, after));

    expect(node1).toStrictEqual({ x: 100, y: 0, w: 100, h: 100, r: Math.PI / 2 });
    expect(node2).toStrictEqual({ x: 0, y: 100, w: 100, h: 100, r: Math.PI / 2 });
  });
});

describe('Rotation', () => {
  test('rotate point', () => {
    let p1: Point = { x: -10, y: -10 };
    let p2: Point = { x: 10, y: 10 };

    p1 = new Rotation(Math.PI / 2).apply(p1);
    p2 = new Rotation(Math.PI / 2).apply(p2);

    expect(p1).toStrictEqual({ x: 10, y: -10 });
    expect(p2).toStrictEqual({ x: -10, y: 10 });
  });

  test('rotate box', () => {
    let b1: Box = { x: -10, y: -10, w: 10, h: 10, r: 0 };
    let b2: Box = { x: 10, y: 10, w: 10, h: 10, r: 0 };

    b1 = new Rotation(Math.PI / 2).apply(b1);
    b2 = new Rotation(Math.PI / 2).apply(b2);

    expect(Point.round(b1)).toStrictEqual({ x: 0, y: -10 });
    expect(Point.round(b2)).toStrictEqual({ x: -20, y: 10 });
  });
});
