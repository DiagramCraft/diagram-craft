import { Point } from './point.ts';
import { Range } from './range.ts';
import { Vector } from './vector.ts';
import { round } from '../utils/math.ts';

export type Line = Readonly<{
  from: Point;
  to: Point;
}>;

export const OLine = {
  fromRange: (pos: { x: number } | { y: number }, range: Range) => {
    if ('x' in pos) {
      return Line.from({ x: pos.x, y: range[0] }, { x: pos.x, y: range[1] });
    } else {
      return Line.from({ y: pos.y, x: range[0] }, { y: pos.y, x: range[1] });
    }
  }
};

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

  from: (from: Point, to: Point) => {
    return { from, to };
  },

  midpoint: (line: Line) => {
    return Point.midpoint(line.from, line.to);
  },

  move: (line: Line, delta: Vector) => {
    return {
      from: Point.add(line.from, delta),
      to: Point.add(line.to, delta)
    };
  },

  isHorizontal: (line: Line) => {
    return round(line.from.y) === round(line.to.y);
  }
};
