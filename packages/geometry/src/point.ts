import { Vector } from './vector';
import { isSame, round } from '@diagram-craft/utils';

export type Point = Readonly<{
  x: number;
  y: number;
}>;

export const Point = {
  ORIGIN: { x: 0, y: 0 },

  of: (x: number, y: number) => ({ x, y }),
  ofTuple: (p: [number, number]) => ({ x: p[0], y: p[1] }),

  add: (c1: Point, c2: Vector) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),

  subtract: (c1: Point, c2: Vector) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  midpoint: (c1: Point, c2: Point) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  rotate: (c: Point, r: number) => {
    return {
      x: c.x * Math.cos(r) - c.y * Math.sin(r),
      y: c.x * Math.sin(r) + c.y * Math.cos(r)
    };
  },

  rotateAround: (c: Point, r: number, centerOfRotation: Point) => {
    if (round(r) === 0) return c;
    const newCoord = Point.subtract(c, centerOfRotation);
    const rotatedCoord = Point.rotate(newCoord, r);
    return Point.add(rotatedCoord, centerOfRotation);
  },

  isEqual: (a: Point, b: Point) => {
    return isSame(a.x, b.x) && isSame(a.y, b.y);
  },

  squareDistance(posA: Point, posB: Point) {
    return Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2);
  },

  distance: (posA: Point, posB: Point) => {
    return Math.sqrt(Point.squareDistance(posA, posB));
  }
};
