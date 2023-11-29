import { Point } from './point.ts';
import { Range } from './range.ts';
import { Vector } from './vector.ts';
import { round } from '../utils/math.ts';

export type Line = Readonly<{
  from: Point;
  to: Point;
}>;

export const Line = {
  extend: (line: Line, fromLength: number, toLength: number) => {
    const v = Vector.from(line.from, line.to);
    const unit = Vector.scale(v, 1 / Math.sqrt(v.x * v.x + v.y * v.y));
    if (isNaN(unit.x) || isNaN(unit.y)) return line;
    return {
      from: Point.subtract(line.from, Vector.scale(unit, fromLength)),
      to: Point.add(line.to, Vector.scale(unit, toLength))
    };
  },

  vertical: (x: number, range: Range) => {
    return Line.of({ x, y: range[0] }, { x, y: range[1] });
  },

  horizontal: (y: number, range: Range) => {
    return Line.of({ y, x: range[0] }, { y, x: range[1] });
  },

  of: (from: Point, to: Point) => {
    return { from, to };
  },

  midpoint: (line: Line) => {
    return Point.midpoint(line.from, line.to);
  },

  move: (line: Line, delta: Vector) => {
    return Line.of(Point.add(line.from, delta), Point.add(line.to, delta));
  },

  isHorizontal: (line: Line) => {
    return round(line.from.y) === round(line.to.y);
  },

  intersection: (line1: Line, line2: Line) => {
    const x1 = line1.from.x;
    const y1 = line1.from.y;
    const x2 = line1.to.x;
    const y2 = line1.to.y;
    const x3 = line2.from.x;
    const y3 = line2.from.y;
    const x4 = line2.to.x;
    const y4 = line2.to.y;

    const t =
      ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) /
      ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    const u =
      ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) /
      ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));

    if (t < 0 || t > 1 || u < 0 || u > 1) return undefined;

    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
};
