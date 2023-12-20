import { Point } from './point.ts';
import { round } from '../utils/math.ts';
import { Line } from './line.ts';

export type Vector = Point;

export const Vector = {
  fromLine: (l: Line) => {
    return { x: l.to.x - l.from.x, y: l.to.y - l.from.y };
  },
  from: (c1: Point, c2: Point) => {
    return { x: c2.x - c1.x, y: c2.y - c1.y };
  },
  crossProduct: (v1: Vector, v2: Vector) => {
    return v1.x * v2.y - v1.y * v2.x;
  },
  angle: (v: Vector) => {
    return Math.atan2(v.y, v.x);
  },
  angle2: (v1: Vector, v2: Vector) => {
    return Vector.angle(v2) - Vector.angle(v1);
  },
  length: (v: Vector) => {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },
  fromPolar: (angle: number, length: number) => {
    return { x: length * Math.cos(angle), y: length * Math.sin(angle) };
  },
  negate: (c: Vector) => ({ x: -c.x, y: -c.y }),
  scale: (c: Vector, s: number) => {
    return { x: c.x * s, y: c.y * s };
  },
  round: (c: Vector) => {
    return { x: round(c.x), y: round(c.y) };
  },
  dot: (v1: Vector, v2: Vector) => {
    return v1.x * v2.x + v1.y * v2.y;
  }
};
