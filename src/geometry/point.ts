import { Vector } from './vector.ts';
import { round } from '../utils/math.ts';

export type Point = Readonly<{
  x: number;
  y: number;
}>;

export const Point = {
  ORIGIN: { x: 0, y: 0 },

  add: (c1: Point, c2: Vector) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),

  subtract: (c1: Point, c2: Vector) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  midpoint: (c1: Point, c2: Point) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  // TODO: Better name for this
  //       ... and move it elsewhere
  fromEvent: (e: { offsetX: number; offsetY: number }) => {
    return { x: e.offsetX, y: e.offsetY };
  },

  round: (c: Point) => {
    return { x: round(c.x), y: round(c.y) };
  },

  rotate: (c: Point, r: number) => {
    return {
      x: c.x * Math.cos(r) - c.y * Math.sin(r),
      y: c.x * Math.sin(r) + c.y * Math.cos(r)
    };
  },

  rotateAround: (c: Point, r: number, centerOfRotation: Point) => {
    const newCoord = Point.subtract(c, centerOfRotation);
    const rotatedCoord = Point.rotate(newCoord, r);
    return Point.add(rotatedCoord, centerOfRotation);
  },

  isEqual: (a: Point, b: Point) => {
    return a.x === b.x && a.y === b.y;
  },

  squareDistance(posA: Point, posB: Point) {
    return Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2);
  },

  distance: (posA: Point, posB: Point) => {
    return Math.sqrt(Point.squareDistance(posA, posB));
  }
};
