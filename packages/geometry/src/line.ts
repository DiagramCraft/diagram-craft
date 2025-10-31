/**
 * Line segment operations including intersection, overlap, projection, and measurement.
 *
 * @example
 * ```ts
 * import { Line } from '@diagram-craft/geometry/line';
 *
 * // Create a line segment
 * const line = Line.of({ x: 0, y: 0 }, { x: 100, y: 100 });
 *
 * // Find intersection of two lines
 * const intersection = Line.intersection(line1, line2);
 *
 * // Project a point onto a line
 * const projected = Line.projectPoint(line, mousePosition);
 *
 * // Check if lines overlap
 * const overlap = Line.overlap(edge1, edge2);
 * if (overlap) {
 *   console.log('Lines overlap by', Line.length(overlap));
 * }
 *
 * // Create vertical and horizontal lines
 * const vLine = Line.vertical(100, [0, 500]);
 * const hLine = Line.horizontal(200, [0, 800]);
 * ```
 *
 * @module
 */

import { Point } from './point';
import { Range } from './range';
import { Vector } from './vector';
import { isSame } from '@diagram-craft/utils/math';
import { Axis } from './axis';

/**
 * Represents a line segment defined by two points.
 */
export type Line = Readonly<{
  from: Point;
  to: Point;
}>;

/**
 * Utility functions for working with Line objects.
 *
 * @namespace
 */
export const Line = {
  /**
   * Extends a line segment in both directions by the specified lengths.
   *
   * @param line The line to extend
   * @param fromLength The length to extend from the start point
   * @param toLength The length to extend from the end point
   * @returns A new line extended by the specified amounts
   */
  extend: (line: Line, fromLength: number, toLength: number) => {
    const v = Vector.from(line.from, line.to);
    const unit = Vector.scale(v, 1 / Math.sqrt(v.x * v.x + v.y * v.y));
    if (Number.isNaN(unit.x) || Number.isNaN(unit.y)) return line;
    return {
      from: Point.subtract(line.from, Vector.scale(unit, fromLength)),
      to: Point.add(line.to, Vector.scale(unit, toLength))
    };
  },

  /**
   * Creates a vertical line at the specified x coordinate within the given range.
   *
   * @param x The x coordinate of the vertical line
   * @param range The y-coordinate range [min, max]
   * @returns A new vertical line
   */
  vertical: (x: number, range: Range) => {
    return Line.of({ x, y: range[0] }, { x, y: range[1] });
  },

  /**
   * Creates a horizontal line at the specified y coordinate within the given range.
   *
   * @param y The y coordinate of the horizontal line
   * @param range The x-coordinate range [min, max]
   * @returns A new horizontal line
   */
  horizontal: (y: number, range: Range) => {
    return Line.of({ y, x: range[0] }, { y, x: range[1] });
  },

  /**
   * Creates a line from two points.
   *
   * @param from The starting point
   * @param to The ending point
   * @returns A new line
   */
  of: (from: Point, to: Point) => {
    return { from, to };
  },

  /**
   * Calculates the midpoint of a line segment.
   *
   * @param line The line
   * @returns The midpoint
   */
  midpoint: (line: Line) => {
    return Point.midpoint(line.from, line.to);
  },

  /**
   * Moves a line by a vector delta.
   *
   * @param line The line to move
   * @param delta The vector to move by
   * @returns A new line moved by the delta
   */
  move: (line: Line, delta: Vector) => {
    return Line.of(Point.add(line.from, delta), Point.add(line.to, delta));
  },

  /**
   * Checks if a line is horizontal (start and end points have the same y coordinate).
   *
   * @param line The line to check
   * @returns True if the line is horizontal, false otherwise
   */
  isHorizontal: (line: Line) => {
    return isSame(line.from.y, line.to.y);
  },

  /**
   * Checks if a line is vertical (start and end points have the same x coordinate).
   *
   * @param line The line to check
   * @returns True if the line is vertical, false otherwise
   */
  isVertical: (line: Line) => {
    return isSame(line.from.x, line.to.x);
  },

  /**
   * Calculates the orthogonal distance between two lines along a specified axis.
   *
   * @param line1 The first line
   * @param line2 The second line
   * @param axis The axis along which to calculate the distance
   * @returns The distance between the lines
   */
  orthogonalDistance: (line1: Line, line2: Line, axis: Axis) => {
    return line1.from[Axis.toXY(axis)] - line2.from[Axis.toXY(axis)];
  },

  /**
   * Finds the intersection point of two lines.
   *
   * @param l1 The first line
   * @param l2 The second line
   * @param extend If true, extend the lines infinitely to find intersection; if false, only check the line segments
   * @returns The intersection point, or undefined if the lines don't intersect
   */
  intersection: (l1: Line, l2: Line, extend = false) => {
    const t =
      ((l1.from.x - l2.from.x) * (l2.from.y - l2.to.y) -
        (l1.from.y - l2.from.y) * (l2.from.x - l2.to.x)) /
      ((l1.from.x - l1.to.x) * (l2.from.y - l2.to.y) -
        (l1.from.y - l1.to.y) * (l2.from.x - l2.to.x));
    const u =
      ((l1.from.x - l2.from.x) * (l1.from.y - l1.to.y) -
        (l1.from.y - l2.from.y) * (l1.from.x - l1.to.x)) /
      ((l1.from.x - l1.to.x) * (l2.from.y - l2.to.y) -
        (l1.from.y - l1.to.y) * (l2.from.x - l2.to.x));

    if (Number.isNaN(t) || Number.isNaN(u)) return undefined;
    if (!extend && (t < 0 || t > 1 || u < 0 || u > 1)) return undefined;

    return { x: l1.from.x + t * (l1.to.x - l1.from.x), y: l1.from.y + t * (l1.to.y - l1.from.y) };
  },

  /**
   * Finds the overlapping segment of two collinear lines.
   *
   * Returns undefined if the lines are not collinear, don't overlap, or have zero length.
   *
   * @param l1 The first line
   * @param l2 The second line
   * @returns The overlapping line segment, or undefined if no overlap exists
   */
  overlap: (l1: Line, l2: Line): Line | undefined => {
    // Check if lines are collinear
    const v1 = Vector.from(l1.from, l1.to);
    const v2 = Vector.from(l2.from, l2.to);
    const v3 = Vector.from(l1.from, l2.from);

    const cross1 = Vector.crossProduct(v1, v2);
    const cross2 = Vector.crossProduct(v1, v3);

    if (!isSame(cross1, 0) || !isSame(cross2, 0)) return undefined;
    if (Line.length(l1) === 0 || Line.length(l2) === 0) return undefined;

    // Project points onto first line
    const t1 = Vector.dotProduct(Vector.from(l1.from, l2.from), v1) / Vector.dotProduct(v1, v1);
    const t2 = Vector.dotProduct(Vector.from(l1.from, l2.to), v1) / Vector.dotProduct(v1, v1);

    // Find overlap
    const tMin = Math.max(0, Math.min(t1, t2));
    const tMax = Math.min(1, Math.max(t1, t2));

    if (tMin > tMax) return undefined;

    const line = {
      from: Point.add(l1.from, Vector.scale(v1, tMin)),
      to: Point.add(l1.from, Vector.scale(v1, tMax))
    };
    if (Line.length(line) === 0) return undefined;
    return line;
  },

  /**
   * Calculates the length of a line segment.
   *
   * @param l The line
   * @returns The length of the line
   */
  length(l: Line) {
    return Vector.length(Vector.from(l.from, l.to));
  },

  /**
   * Projects a point onto a line segment, returning the closest point on the line.
   *
   * If the projection falls outside the line segment, returns the closest endpoint.
   *
   * @param l The line
   * @param p The point to project
   * @returns The closest point on the line segment
   */
  projectPoint(l: Line, p: Point) {
    const v = Vector.from(l.from, l.to);
    const w = Vector.from(l.from, p);
    const c1 = Vector.dotProduct(w, v);
    if (c1 <= 0) return l.from;
    const c2 = Vector.dotProduct(v, v);
    if (c2 <= c1) return l.to;
    const b = c1 / c2;
    return Point.add(l.from, Vector.scale(v, b));
  },

  /**
   * Checks if a point lies on a line segment.
   *
   * @param p The point to check
   * @param l The line
   * @returns True if the point is on the line, false otherwise
   */
  isOn(p: Point, l: Line) {
    return Point.isEqual(p, Line.projectPoint(l, p));
  }
};
