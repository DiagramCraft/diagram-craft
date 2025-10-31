/**
 * Path segment implementations including lines, cubic bezier curves, and quadratic bezier curves.
 *
 * This module provides classes for representing different types of path segments and operations
 * on them including intersection detection, point projection, splitting, and length calculation.
 *
 * @example
 * ```ts
 * import { LineSegment, CubicSegment, QuadSegment } from '@diagram-craft/geometry/pathSegment';
 *
 * // Create a line segment
 * const line = new LineSegment({ x: 0, y: 0 }, { x: 100, y: 100 });
 * console.log(line.length()); // ~141.42
 *
 * // Get a point at t=0.5 (midpoint)
 * const midpoint = line.point(0.5);
 * console.log(midpoint); // { x: 50, y: 50 }
 *
 * // Create a cubic bezier segment
 * const cubic = new CubicSegment(
 *   { x: 0, y: 0 },    // start
 *   { x: 25, y: 100 },  // control point 1
 *   { x: 75, y: 100 },  // control point 2
 *   { x: 100, y: 0 }    // end
 * );
 *
 * // Find intersections between segments
 * const line1 = new LineSegment({ x: 0, y: 50 }, { x: 100, y: 50 });
 * const line2 = new LineSegment({ x: 50, y: 0 }, { x: 50, y: 100 });
 * const intersections = line1.intersectionsWith(line2);
 * // Result: [{ type: 'intersection', point: { x: 50, y: 50 } }]
 *
 * // Split a segment at t=0.5
 * const [first, second] = line.split(0.5);
 *
 * // Project a point onto a segment
 * const projection = line.projectPoint({ x: 60, y: 40 });
 * // Result: { point: { x: 50, y: 50 }, t: 0.5, distance: 14.14 }
 * ```
 *
 * @module
 */

import { Point } from './point';
import { Vector } from './vector';
import { Line } from './line';
import { CubicBezier } from './bezier';
import type { RawSegment } from './pathListBuilder';
import type { Projection } from './path';
import { Box } from './box';
import { clamp, round } from '@diagram-craft/utils/math';

/**
 * Represents the result of an intersection between two path segments.
 */
export interface Intersection {
  /** The intersection point */
  point: Point;
  /** The type of intersection - either a point intersection or an overlapping segment */
  type: 'overlap' | 'intersection';
  /** For overlaps, the start point of the overlapping region */
  start?: Point;
  /** For overlaps, the end point of the overlapping region */
  end?: Point;
}

/**
 * Options for controlling intersection detection behavior.
 */
export type IntersectionOpts = {
  /** If true, also detect overlapping segments (default: false) */
  includeOverlaps?: boolean;
};

/**
 * Interface representing a segment of a path.
 *
 * A path segment can be a line, cubic bezier curve, or quadratic bezier curve.
 * All segments support common operations like length calculation, point evaluation,
 * intersection detection, and splitting.
 */
export interface PathSegment {
  /** Calculates the arc length of the segment */
  length(): number;

  /**
   * Evaluates the segment at parametric value t (0 to 1).
   * @param t The parametric value (0 = start, 1 = end)
   * @returns The point at parameter t
   */
  point(t: number): Point;

  /**
   * Finds intersections with another path segment.
   * @param other The other segment to check for intersections
   * @param opts Options for intersection detection
   * @returns Array of intersection results
   */
  intersectionsWith(other: PathSegment, opts?: IntersectionOpts): Intersection[];

  /**
   * Projects a point onto the segment, finding the closest point.
   * @param point The point to project
   * @param limit If true, limit to segment bounds (default: true)
   * @returns Projection information including closest point, t value, and distance
   */
  projectPoint(point: Point, limit?: boolean): Projection;

  /** Converts the segment to raw segment format for serialization */
  raw(): RawSegment[];

  /**
   * Splits the segment at parametric value t.
   * @param t The parametric value where to split (0 to 1)
   * @returns Two new segments: before and after the split point
   */
  split(t: number): [PathSegment, PathSegment];

  /**
   * Finds the parametric value t for a given arc length along the segment.
   * @param length The arc length from the start
   * @returns The parametric value t
   */
  tAtLength(length: number): number;

  /**
   * Calculates the arc length at parametric value t.
   * @param t The parametric value (0 to 1)
   * @returns The arc length from start to t
   */
  lengthAtT(t: number): number;

  /**
   * Calculates the tangent vector at parametric value t.
   * @param t The parametric value (0 to 1)
   * @returns The normalized tangent vector
   */
  tangent(t: number): Vector;

  /** Calculates the bounding box of the segment */
  bounds(): Box;

  /** Creates a new segment with reversed direction */
  reverse(): PathSegment;

  /**
   * Checks if this segment equals another segment.
   * @param pathSegment The segment to compare with
   * @returns True if segments are equal
   */
  equals(pathSegment: PathSegment): boolean;

  /** The start point of the segment */
  start: Point;

  /** The end point of the segment */
  end: Point;
}

/**
 * Represents a straight line segment between two points.
 *
 * LineSegment is the simplest path segment type, representing a straight line
 * from a start point to an end point.
 */
export class LineSegment implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly end: Point
  ) {}

  raw(): RawSegment[] {
    return [['L', this.end.x, this.end.y]];
  }

  split(t: number): [PathSegment, PathSegment] {
    const p = this.point(t);
    return [new LineSegment(this.start, p), new LineSegment(p, this.end)];
  }

  tAtLength(length: number): number {
    return length / this.length();
  }

  lengthAtT(t: number): number {
    return this.length() * t;
  }

  equals(pathSegment: PathSegment): boolean {
    return (
      pathSegment instanceof LineSegment &&
      Point.isEqual(pathSegment.start, this.start) &&
      Point.isEqual(pathSegment.end, this.end)
    );
  }

  projectPoint(point: Point, limit = true): Projection {
    const px = this.end.x - this.start.x;
    const py = this.end.y - this.start.y;
    const d = px * px + py * py;
    const tRaw = ((point.x - this.start.x) * px + (point.y - this.start.y) * py) / d;
    const t = limit ? clamp(tRaw, 0, 1) : tRaw;

    const projection = { x: this.start.x + t * px, y: this.start.y + t * py };

    return {
      point: projection,
      t,
      distance: Point.distance(point, projection)
    };
  }

  intersectionsWith(other: PathSegment, opts: IntersectionOpts): Intersection[] {
    if (other instanceof LineSegment) {
      if (opts?.includeOverlaps) {
        const line = Line.of(this.start, this.end);
        const o = Line.overlap(line, Line.of(other.start, other.end));
        if (o && Point.distance(o.from, o.to) > 0.001 * Line.length(line))
          return [{ type: 'overlap', point: Line.midpoint(o), start: o.from, end: o.to }];
      }

      const p = Line.intersection(Line.of(this.start, this.end), Line.of(other.start, other.end));
      if (p) return [{ type: 'intersection', point: p }];
      return [];
    } else {
      return other.intersectionsWith(this, opts);
    }
  }

  length() {
    return Point.distance(this.start, this.end);
  }

  point(t: number) {
    return {
      x: this.start.x + (this.end.x - this.start.x) * t,
      y: this.start.y + (this.end.y - this.start.y) * t
    };
  }

  tangent(_t: number) {
    return Vector.normalize(Vector.from(this.start, this.end));
  }

  bounds() {
    return Box.fromLine(Line.of(this.start, this.end));
  }

  reverse() {
    return new LineSegment(this.end, this.start);
  }
}

/**
 * Represents a cubic Bézier curve segment.
 *
 * A cubic Bézier curve is defined by four points: a start point, two control points,
 * and an end point. The curve passes through the start and end points while the
 * control points determine the shape of the curve.
 *
 * @example
 * ```ts
 * // Create a cubic curve
 * const curve = new CubicSegment(
 *   { x: 0, y: 0 },    // start
 *   { x: 25, y: 100 }, // first control point
 *   { x: 75, y: 100 }, // second control point
 *   { x: 100, y: 0 }   // end
 * );
 *
 * // Get point at t=0.5
 * const midpoint = curve.point(0.5);
 *
 * // Split the curve
 * const [firstHalf, secondHalf] = curve.split(0.5);
 * ```
 */
export class CubicSegment implements PathSegment {
  private readonly bezier: CubicBezier;

  /**
   * Creates a new cubic Bézier segment.
   *
   * @param start The start point of the curve
   * @param p1 The first control point
   * @param p2 The second control point
   * @param end The end point of the curve
   */
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    public readonly p2: Point,
    public readonly end: Point
  ) {
    this.bezier = new CubicBezier(start, p1, p2, end);
  }

  /**
   * Creates a cubic Bézier segment from a line segment.
   *
   * The control points are placed at 1/4 and 3/4 of the line to approximate a straight line.
   *
   * @param s The line segment to convert
   * @returns A cubic Bézier segment approximating the line
   */
  static fromLine(s: LineSegment) {
    return new CubicSegment(
      s.start,
      Point.add(s.start, Vector.scale(Vector.from(s.start, s.end), 0.25)),
      Point.add(s.end, Vector.scale(Vector.from(s.end, s.start), 0.25)),
      s.end
    );
  }

  length(): number {
    return this.bezier.length();
  }

  point(t: number) {
    return this.bezier.point(t);
  }

  projectPoint(point: Point, _limit = true): Projection {
    return this.bezier.projectPoint(point);
  }

  tAtLength(length: number): number {
    return this.bezier.tAtLength(length);
  }

  lengthAtT(t: number): number {
    return this.bezier.lengthAtT(t);
  }

  tangent(t: number) {
    return this.bezier.tangent(t);
  }

  reverse() {
    return new CubicSegment(this.end, this.p2, this.p1, this.start);
  }

  split(t: number): [CubicSegment, CubicSegment] {
    const b = this.bezier.split(t);
    return [
      new CubicSegment(b[0].start, b[0].cp1, b[0].cp2, b[0].end),
      new CubicSegment(b[1].start, b[1].cp1, b[1].cp2, b[1].end)
    ];
  }

  equals(pathSegment: PathSegment): boolean {
    return (
      pathSegment instanceof CubicSegment &&
      Point.isEqual(pathSegment.start, this.start) &&
      Point.isEqual(pathSegment.end, this.end) &&
      Point.isEqual(pathSegment.p1, this.p1) &&
      Point.isEqual(pathSegment.p2, this.p2)
    );
  }

  bounds() {
    return this.bezier.bbox();
  }

  raw(): RawSegment[] {
    return [
      [
        'C',
        round(this.p1.x),
        round(this.p1.y),
        round(this.p2.x),
        round(this.p2.y),
        round(this.end.x),
        round(this.end.y)
      ]
    ];
  }

  intersectionsWith(other: PathSegment, opts: IntersectionOpts): Intersection[] {
    if (other instanceof LineSegment) {
      const line = Line.of(other.start, other.end);
      const intersections = this.bezier.intersectsLine(line);
      // TODO: Ideally we should integrate this into the bezier algorithm
      if (!intersections || intersections.length === 0) {
        // Check for intersections with endpoints
        if (Line.isOn(this.start, line)) return [{ type: 'intersection', point: this.start }];
        if (Line.isOn(this.end, line)) return [{ type: 'intersection', point: this.end }];
      } else {
        return intersections.map(i => ({ type: 'intersection', point: i }));
      }
    } else if (other instanceof CubicSegment) {
      const intersections: Intersection[] = this.bezier
        .intersectsBezier(other.bezier)
        .map(i => ({ type: 'intersection', point: i }));
      if (opts?.includeOverlaps) {
        const overlap = this.bezier.overlap(other.bezier);
        if (overlap) {
          intersections.push({
            type: 'overlap',
            start: overlap.start,
            end: overlap.end,
            point: overlap.point(0.5)
          });
        }
      }
      return intersections;
    } else {
      return other.intersectionsWith(this);
    }
    return [];
  }

  /*normalize(): NormalizedSegment[] {
    return [['C', this.p1.x, this.p1.y, this.p2.x, this.p2.y, this.end.x, this.end.y]];
  }*/
}

/**
 * Represents a quadratic Bézier curve segment.
 *
 * A quadratic Bézier curve is defined by three points: a start point, a control point,
 * and an end point. Internally, it's converted to a cubic Bézier curve for uniform handling.
 *
 * The quadratic curve passes through the start and end points while the control point
 * determines the shape of the curve.
 *
 * @example
 * ```ts
 * // Create a quadratic curve
 * const quad = new QuadSegment(
 *   { x: 0, y: 0 },   // start
 *   { x: 50, y: 100 }, // control point
 *   { x: 100, y: 0 }   // end
 * );
 *
 * // Get point at t=0.5
 * const midpoint = quad.point(0.5);
 * ```
 */
export class QuadSegment extends CubicSegment {
  /** The original quadratic control point (before conversion to cubic) */
  quadP1: Point;

  /**
   * Creates a new quadratic Bézier segment.
   *
   * The quadratic curve is internally converted to a cubic curve.
   *
   * @param start The start point of the curve
   * @param p1 The control point
   * @param end The end point of the curve
   */
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    public readonly end: Point
  ) {
    super(
      start,
      {
        x: (1 / 3) * start.x + (2 / 3) * p1.x,
        y: (1 / 3) * start.y + (2 / 3) * p1.y
      },
      {
        x: (2 / 3) * p1.x + (1 / 3) * end.x,
        y: (2 / 3) * p1.y + (1 / 3) * end.y
      },
      end
    );
    this.quadP1 = p1;
  }
}
