/**
 * Path representation and operations for complex curves including lines, quadratic, and cubic bezier segments.
 *
 * @example
 * ```ts
 * import { Path } from '@diagram-craft/geometry/path';
 *
 * // Create a path with line and cubic bezier segments
 * const path = new Path({ x: 0, y: 0 }, [
 *   ['L', 100, 0],
 *   ['C', 100, 50, 150, 50, 150, 100]
 * ]);
 *
 * // Get the length of the path
 * const length = path.length();
 *
 * // Find a point along the path at a specific distance
 * const point = path.pointAt({ pathD: length / 2 });
 *
 * // Project a point onto the path
 * const projected = path.projectPoint(mousePosition);
 *
 * // Check if a point is on or inside the path
 * if (path.isOn(point)) {
 *   console.log('Point is on the path');
 * }
 *
 * // Split a path at specific points
 * const [part1, part2] = path.split({ segment: 2, segmentT: 0.5 });
 *
 * // Create an offset path (parallel curve)
 * const offsetPath = path.offset(10);
 * ```
 *
 * @module
 */

import { Point } from './point';
import {
  CubicSegment,
  type Intersection,
  type IntersectionOpts,
  LineSegment,
  PathSegment,
  QuadSegment
} from './pathSegment';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from './pathPosition';
import type { RawSegment } from './pathListBuilder';
import { BezierUtils } from './bezier';
import { Box } from './box';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { isSame, round } from '@diagram-craft/utils/math';
import { Vector } from './vector';
import { Line } from './line';
import { Lazy } from '@diagram-craft/utils/lazy';
import { safeTupleCast } from '@diagram-craft/utils/safe';

/**
 * Represents the result of projecting a point onto a path or segment.
 */
export type Projection = { t: number; distance: number; point: Point };

class SegmentList {
  constructor(public readonly segments: PathSegment[]) {}

  static make(start: Point, path: ReadonlyArray<RawSegment>) {
    const dest: Array<PathSegment> = [];

    let end = start;

    for (const seg of path) {
      const command = seg[0];

      switch (command) {
        case 'L':
          dest.push(new LineSegment(end, { x: seg[1], y: seg[2] }));
          break;
        case 'C': {
          const [, p1x, p1y, p2x, p2y, ex, ey] = seg;
          dest.push(
            new CubicSegment(end, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey })
          );
          break;
        }
        case 'Q':
          dest.push(new QuadSegment(end, { x: seg[1], y: seg[2] }, { x: seg[3], y: seg[4] }));
          break;
        case 'T': {
          const cp = (dest.at(-1) as QuadSegment).quadP1;
          const cp2 = Point.add(end, Point.subtract(end, cp));
          dest.push(new QuadSegment(end, cp2, { x: seg[1], y: seg[2] }));
          break;
        }
        case 'A': {
          const [, rx, ry, angle, larc, sweep, x2, y2] = seg;
          const cubicSegments = BezierUtils.fromArc(
            end.x,
            end.y,
            rx,
            ry,
            angle,
            larc,
            sweep,
            x2,
            y2
          );

          for (const [, p1x, p1y, p2x, p2y, ex, ey] of cubicSegments) {
            dest.push(
              new CubicSegment(end, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey })
            );
            end = { x: ex, y: ey };
          }
          break;
        }

        default:
          throw new VerifyNotReached();
      }

      end = dest.at(-1)!.end;
    }

    return new SegmentList(dest);
  }

  length() {
    return this.segments.reduce((acc, cur) => acc + cur.length(), 0);
  }

  pointAt(t: LengthOffsetOnPath) {
    // Find the segment that contains the point
    let currentD = t.pathD;
    let segmentIndex = 0;
    let segment = this.segments[segmentIndex]!;
    while (currentD > segment.length()) {
      currentD -= segment.length();
      segment = this.segments[++segmentIndex]!;
    }

    // TODO: This is a bit incorrect, we should probably use tAtLength here
    return segment.point(currentD / segment.length());
  }

  tangentAt(t: LengthOffsetOnPath) {
    // Find the segment that contains the point
    let currentD = t.pathD;
    let segmentIndex = 0;
    let segment = this.segments[segmentIndex]!;
    while (currentD > segment.length()) {
      currentD -= segment.length();
      segment = this.segments[++segmentIndex]!;
    }

    // TODO: This is a bit incorrect, we should probably use tAtLength here
    return segment.tangent(currentD / segment.length());
  }

  projectPoint(point: Point, limit = true): Projection & { segmentIndex: number; globalL: number } {
    let bestSegment = -1;
    let bestProject: Projection | undefined;
    let bestDistance = Number.MAX_VALUE;

    const segments = this.segments;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      const projection = s.projectPoint(point, limit);
      if (projection.distance < bestDistance) {
        bestProject = projection;
        bestDistance = projection.distance;
        bestSegment = i;
      }
    }

    if (!bestProject) {
      return { segmentIndex: 0, t: 0, globalL: 0, distance: 0, point };
    }

    const l = this.segments.slice(0, bestSegment).reduce((acc, cur) => acc + cur.length(), 0);
    return {
      segmentIndex: bestSegment,
      t: bestProject.t,

      // TODO: Should we really return this back here - as it's a bit expensive to calculate
      globalL: l + this.segments[bestSegment]!.lengthAtT(bestProject.t),
      distance: bestProject.distance,
      point: bestProject.point
    };
  }
}

/**
 * Represents a path composed of line segments and bezier curves.
 *
 * A Path consists of a starting point and a series of path segments (lines, quadratic, or cubic beziers).
 * It provides operations for measuring length, projecting points, finding intersections, splitting,
 * offsetting, and more.
 */
export class Path {
  readonly #path: RawSegment[] = [];
  readonly #segmentList;
  readonly #start: Point;

  constructor(start: Point, path: RawSegment[], segmentList?: SegmentList) {
    this.#path = path;
    this.#start = start;
    this.#segmentList = new Lazy<SegmentList>(
      () => SegmentList.make(this.start, this.#path),
      segmentList
    );
  }

  /**
   * Joins multiple paths into a single path.
   *
   * @param paths The paths to join
   * @returns A new path containing all segments from the input paths
   */
  static join(...paths: Path[]) {
    assert.arrayNotEmpty(paths);
    const dest: RawSegment[] = [];
    for (const path of paths) {
      dest.push(...path.#path);
    }
    return new Path(paths[0].start, dest);
  }

  /**
   * Creates a new path from an existing path by transforming its segments.
   *
   * @param p The source path
   * @param fn A function that transforms the segments
   * @returns A new path with transformed segments
   */
  static from(p: Path, fn: (segments: ReadonlyArray<PathSegment>) => PathSegment[]) {
    const segmentList = new SegmentList(fn(p.segmentList.segments));
    const path = segmentList.segments.flatMap(e => e.raw());
    return new Path(p.start, path, segmentList);
  }

  private get segmentList() {
    return this.#segmentList.get();
  }

  /**
   * Creates a deep copy of the path.
   *
   * @returns A new path with the same start point and segments
   */
  clone() {
    return new Path(
      this.start,
      this.#path.slice().map(e => [...e]),
      this.segmentList
    );
  }

  /**
   * Gets the midpoint of each segment in the path.
   */
  get midpoints(): ReadonlyArray<Point> {
    return this.segments.map((s: PathSegment) => {
      return s.point(0.5);
    });
  }

  /**
   * Gets the starting point of the path.
   */
  get start() {
    return this.#start;
  }

  /**
   * Gets the ending point of the path.
   */
  get end(): Point {
    return this.segmentList.segments.at(-1)!.end;
  }

  /**
   * Gets the raw segment data of the path.
   */
  get raw() {
    return this.#path;
  }

  /**
   * Gets the path segments.
   */
  get segments(): ReadonlyArray<PathSegment> {
    return this.segmentList.segments;
  }

  /**
   * Creates a new path with all segments reversed.
   *
   * @returns A new path that goes from the original end point to the original start point
   */
  reverse() {
    const end = this.end;

    const newSegmentList: PathSegment[] = [];
    const segments = SegmentList.make(this.#start, this.#path).segments;
    for (let i = segments.length - 1; i >= 0; i--) {
      newSegmentList.push(segments[i]!.reverse());
    }

    return new Path(
      end,
      newSegmentList.flatMap(s => s.raw())
    );
  }

  /**
   * Checks if a point is inside a closed path using the ray casting algorithm.
   *
   * @param p The point to check
   * @returns True if the point is inside the path, false otherwise
   */
  isInside(p: Point) {
    const line = new Path(p, [['L', Number.MAX_SAFE_INTEGER / 17, Number.MAX_SAFE_INTEGER / 53]]);
    const intersections = this.intersections(line);
    return intersections.length % 2 !== 0;
  }

  /**
   * Checks if a point lies on the path within a given tolerance.
   *
   * @param p The point to check
   * @param epsilon The tolerance for the check (default: 0.0001)
   * @returns True if the point is on the path, false otherwise
   */
  isOn(p: Point, epsilon = 0.0001) {
    const pp = this.projectPoint(p);
    return (
      Point.isEqual(pp.point, p, epsilon) &&
      pp.segmentT >= 0 - epsilon &&
      pp.segmentT <= 1 + epsilon
    );
  }

  /**
   * Calculates the total length of the path.
   *
   * @returns The length of the path
   */
  length() {
    return this.segmentList.length();
  }

  /**
   * Finds the point at a specific distance along the path.
   *
   * @param t The length offset along the path
   * @returns The point at that position
   */
  pointAt(t: LengthOffsetOnPath) {
    return this.segmentList.pointAt(t);
  }

  /**
   * Calculates the tangent vector at a specific distance along the path.
   *
   * @param t The length offset along the path
   * @returns The tangent vector at that position
   */
  tangentAt(t: LengthOffsetOnPath) {
    return this.segmentList.tangentAt(t);
  }

  /**
   * Projects a point onto the path, finding the closest point on the path.
   *
   * @param point The point to project
   * @param limit If true, limit the projection to the path bounds
   * @returns The projected point with position information
   */
  projectPoint(point: Point, limit = true): PointOnPath & LengthOffsetOnPath & TimeOffsetOnSegment {
    const projection = this.segmentList.projectPoint(point, limit);

    return {
      pathD: projection.globalL,
      segmentT: projection.t,
      point: projection.point,
      segment: projection.segmentIndex
    };
  }

  /**
   * Finds all intersection points between this path and another path.
   *
   * @param other The other path to check for intersections
   * @param opts Options for intersection detection
   * @returns Array of intersection points with segment information
   */
  intersections(
    other: Path,
    opts?: IntersectionOpts
  ): ReadonlyArray<
    WithSegment<PointOnPath> &
      Intersection & {
        otherSegment: number;
      }
  > {
    const dest: Array<WithSegment<PointOnPath> & Intersection & { otherSegment: number }> = [];

    const segments = this.segments;

    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx]!;

      for (let oIdx = 0; oIdx < other.segments.length; oIdx++) {
        const otherSegment = other.segments[oIdx]!;

        const intersections = segment.intersectionsWith(otherSegment, opts);
        if (intersections.length === 0) continue;

        dest.push(
          ...intersections.map(i => ({
            point: i.point,
            segment: idx,
            otherSegment: oIdx,
            start: i.start,
            end: i.end,
            type: i.type
          }))
        );
      }
    }

    return dest;
  }

  /**
   * Splits the path at one or two points.
   *
   * If one point is provided, returns two paths. If two points are provided, returns three paths.
   * When both points are on the same segment, the segment is split into three parts.
   *
   * Note: passing a LengthOffsetOnSegment in addition as the first parameter gives
   * a performance boost for calculations.
   *
   * @param p1 The first split point
   * @param p2 Optional second split point
   * @returns Two paths if p2 is not provided, three paths if p2 is provided
   */
  split(
    p1: TimeOffsetOnSegment | (TimeOffsetOnSegment & LengthOffsetOnSegment),
    p2?: TimeOffsetOnSegment
  ): [Path, Path] | [Path, Path, Path] {
    // In case both points are on the same segment, we need to split that segment into
    // three, which is a bit complicated, as we need to calculate the length offset
    if (p2 && p1.segment === p2.segment) {
      // Note: this is a bit of a weird optimization, but it gives quite a bit of
      //       performance boost when we have already calculated the length offset on the segment
      const d1 =
        (p1 as LengthOffsetOnSegment).segmentD ?? this.segments[p1.segment]!.lengthAtT(p1.segmentT);

      // Split into a,b,c as follows
      //
      //          p1  p2
      //          |   |
      //        a | b | c
      // .....|---|---|---|................
      //          |   |
      // -----|---v---v---|----------|-----
      //
      // Result
      // ---------|---|--------------------
      //
      const [prefix, c] = this.segments[p2.segment]!.split(p2.segmentT);
      const [a, b] = prefix.split(prefix.tAtLength(d1));

      return [
        new Path(a.start, [...this.#path.slice(0, p1.segment), ...a.raw()]),
        new Path(b.start, b.raw()),
        new Path(c.start, [...c.raw(), ...this.#path.slice(p1.segment + 1)])
      ];
    }

    // Split into a,b,c,d as follows
    //
    //          p1                  p2
    //          |                   |
    //        a |   b             c | d
    // .....|---|-------|.......|--------|.....
    //          |                   |
    // -----|---v-------|-------|---v----|-----
    //
    // Result
    // ---------|-------------------|----------
    //
    const [a, b] = this.segments[p1.segment]!.split(p1.segmentT);

    const dest: Path[] = [new Path(this.#start, [...this.#path.slice(0, p1.segment), ...a.raw()])];
    if (p2) {
      const [c, d] = this.segments[p2.segment]!.split(p2.segmentT);
      dest.push(
        new Path(b.start, [...b.raw(), ...this.#path.slice(p1.segment + 1, p2.segment), ...c.raw()])
      );
      dest.push(new Path(d.start, [...d.raw(), ...this.#path.slice(p2.segment + 1)]));
      return safeTupleCast(dest, 3);
    } else {
      dest.push(new Path(b.start, [...b.raw(), ...this.#path.slice(p1.segment + 1)]));
      return safeTupleCast(dest, 2);
    }
  }

  /**
   * Creates an offset path (parallel curve) at a given distance.
   *
   * Uses the Tiller-Hanson algorithm to create a path parallel to the original
   * at the specified distance.
   *
   * @param n The offset distance (positive for outward, negative for inward)
   * @returns A new path offset from the original
   */
  offset(n: number) {
    // Note: this is basically the Tiller-Hanson algorithm

    // TODO: There's an opportunity to better remove cusps when offsetting
    //       bezier curves... perhaps by splitting the curves under certain conditions

    const entries: Array<{ type: 'L' | 'C'; line: Line }> = [];
    for (const segment of this.segments) {
      if (segment instanceof LineSegment) {
        entries.push({ type: 'L', line: Line.of(segment.start, segment.end) });
      } else if (segment instanceof CubicSegment) {
        entries.push({ type: 'C', line: Line.of(segment.start, segment.p1) });
        entries.push({ type: 'C', line: Line.of(segment.p1, segment.p2) });
        entries.push({ type: 'C', line: Line.of(segment.p2, segment.end) });
      } else {
        VERIFY_NOT_REACHED();
      }
    }

    // Offset all lines
    for (const entry of entries) {
      const v = Vector.normalize(Vector.from(entry.line.from, entry.line.to));
      entry.line = Line.of(
        Point.add(entry.line.from, Vector.scale(Vector.tangentToNormal(v), n)),
        Point.add(entry.line.to, Vector.scale(Vector.tangentToNormal(v), n))
      );
    }

    // Join all lines
    const joinedEntries: Array<{ type: 'L' | 'C'; line: Line }> = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]!;
      const current = entries[i]!;

      const intersection = Line.intersection(prev.line, current.line, true);
      if (!intersection) {
        joinedEntries.push(prev);
      } else {
        prev.line = Line.of(prev.line.from, intersection);
        joinedEntries.push(prev);

        if (!Point.isEqual(current.line.to, intersection)) {
          current.line = Line.of(intersection, current.line.to);
        }
      }
    }
    joinedEntries.push(entries.at(-1)!);

    // For segments from the lines
    const dest: RawSegment[] = [];
    for (let i = 0; i < joinedEntries.length; i++) {
      const entry = joinedEntries[i]!;

      if (entry.type === 'L') {
        dest.push(['L', entry.line.to.x, entry.line.to.y]);
      } else {
        assert.true(joinedEntries[i + 1]!.type === 'C');
        assert.true(joinedEntries[i + 2]!.type === 'C');

        const p1 = joinedEntries[i]!.line.to;
        const p2 = joinedEntries[i + 1]!.line.to;
        const end = joinedEntries[i + 2]!.line.to;

        dest.push(['C', p1.x, p1.y, p2.x, p2.y, end.x, end.y]);

        i += 2;
      }
    }
    return new Path(joinedEntries[0]!.line.from, dest);
  }

  /**
   * Converts the path to an SVG path string.
   *
   * Resolves any T-segments and formats the path as an SVG-compatible string.
   *
   * @returns An SVG path string representation
   */
  asSvgPath() {
    // Need to resolve any T-segments, as many of the QuadSegments will
    // at this point (post processing) have turned into CubicSegment and SVG
    // cannot rended a C-segment followed by a T-segment
    const normalizedPath = this.#path.find(e => e[0] === 'T')
      ? this.segments.flatMap(e => e.raw())
      : this.#path;

    return [
      `M ${round(this.#start.x, 4)},${round(this.#start.y, 4)}`,
      ...normalizedPath.map(r => {
        // We know the first element of a raw segment is the command, followed
        // by a number of numbers
        const [command, ...numbers] = r;

        const roundedNumbers = numbers.map(e => round(e, 4));
        return `${command} ${roundedNumbers.join(',')}`;
      })
    ].join(' ');
  }

  /**
   * Calculates the bounding box of the path.
   *
   * @returns A box that contains the entire path
   */
  bounds() {
    const boxes = this.segments.map(s => s.bounds());
    return Box.boundingBox(boxes);
  }

  /**
   * Removes duplicate consecutive segments from the path.
   *
   * @returns A new path with duplicate segments removed
   */
  clean() {
    // Remove any repeated segments
    const dest: RawSegment[] = [this.#path[0]!];
    for (let i = 1; i < this.#path.length; i++) {
      const current = this.#path[i]!;
      const previous = this.#path[i - 1]!;

      if (current.every((e, idx) => e === previous[idx])) continue;
      dest.push(current);
    }

    return new Path(this.#start, dest);
  }

  /**
   * Determines if the path is oriented clockwise.
   *
   * @returns True if the path is clockwise, false otherwise
   */
  isClockwise() {
    const segments = this.segments;
    let sum = 0;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      const next = segments[(i + 1) % segments.length]!;
      sum += (next.start.x - s.start.x) * (-next.start.y - s.start.y);
    }

    return sum < 0;
  }

  /**
   * Checks if the path encloses an area.
   *
   * Uses a simplistic check for pairwise segments to see if they are reversed.
   *
   * @returns True if the path has area, false otherwise
   */
  hasArea() {
    if (this.segments.length % 2 === 1) return true;
    for (let i = 0; i < this.segments.length; i += 2) {
      const s1 = this.segments[i]!;
      const s2 = this.segments[i + 1]!;
      if (!s1.equals(s2.reverse())) return true;
    }
    return false;
  }

  /**
   * Simplifies the path by merging consecutive collinear line segments.
   *
   * Removes zero-length segments and combines consecutive line segments that go in the same direction.
   *
   * @returns A new simplified path
   */
  simplify() {
    const simplifiedSegments: PathSegment[] = [];
    if (this.segments.length <= 1) return this;

    for (let i = 0; i < this.segments.length; i++) {
      const currentSegment = this.segments[i]!;

      if (!(currentSegment instanceof LineSegment)) {
        simplifiedSegments.push(currentSegment);
        continue;
      }

      // Skip zero-length line segments (where start and end points are the same)
      if (Point.isEqual(currentSegment.start, currentSegment.end)) {
        continue;
      }

      const currentLine = Line.of(currentSegment.start, currentSegment.end);
      const consecutiveLines = [currentSegment];

      // Check for subsequent line segments in the same direction
      while (i + 1 < this.segments.length) {
        const nextSegment = this.segments[i + 1];

        if (!(nextSegment instanceof LineSegment)) break;

        // Skip zero-length segments in the consecutive check as well
        if (Point.isEqual(nextSegment.start, nextSegment.end)) {
          i++; // Skip this zero-length segment
          continue;
        }

        const nextLine = Line.of(nextSegment.start, nextSegment.end);

        // Check if lines are in the same direction by comparing normalized direction vectors
        const currentDirection = Vector.normalize(Vector.from(currentLine.from, currentLine.to));
        const nextDirection = Vector.normalize(Vector.from(nextLine.from, nextLine.to));

        if (
          isSame(currentDirection.x, nextDirection.x) &&
          isSame(currentDirection.y, nextDirection.y)
        ) {
          consecutiveLines.push(nextSegment);
          i++;
        } else {
          break;
        }
      }

      // If we found consecutive line segments in the same direction, merge them
      if (consecutiveLines.length > 1) {
        const mergedSegment = new LineSegment(
          consecutiveLines[0]!.start,
          consecutiveLines[consecutiveLines.length - 1]!.end
        );
        // Double-check that the merged segment is not zero-length
        if (!Point.isEqual(mergedSegment.start, mergedSegment.end)) {
          simplifiedSegments.push(mergedSegment);
        }
      } else {
        simplifiedSegments.push(currentSegment);
      }
    }

    return Path.from(this, () => simplifiedSegments);
  }
}
