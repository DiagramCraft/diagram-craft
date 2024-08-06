import { Point } from './point';
import {
  CubicSegment,
  LineSegment,
  makeCurveSegment,
  PathSegment,
  QuadSegment,
  SegmentList
} from './pathSegment';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from './pathPosition';
import { RawSegment } from './pathBuilder';
import { BezierUtils } from './bezier';
import { Box } from './box';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { roundHighPrecision } from '@diagram-craft/utils/math';
import { Vector } from './vector';
import { Line } from './line';

export type Projection = { t: number; distance: number; point: Point };

const makeSegmentList = (start: Point, path: ReadonlyArray<RawSegment>) => {
  const dest: Array<PathSegment> = [];

  let end = start;

  for (const seg of path) {
    const command = seg[0];

    let s: Array<PathSegment> = [];
    switch (command) {
      case 'L':
        s = [new LineSegment(end, { x: seg[1], y: seg[2] })];
        break;
      case 'C': {
        const [, p1x, p1y, p2x, p2y, ex, ey] = seg;
        s = [new CubicSegment(end, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey })];
        break;
      }
      case 'Q':
        s = [new QuadSegment(end, { x: seg[1], y: seg[2] }, { x: seg[3], y: seg[4] })];
        break;
      case 'T':
        s = [makeCurveSegment(end, { x: seg[1], y: seg[2] }, dest.at(-1)! as QuadSegment)];
        break;
      case 'A': {
        const [, rx, ry, angle, larc, sweep, x2, y2] = seg;
        const cubicSegments = BezierUtils.fromArc(end.x, end.y, rx, ry, angle, larc, sweep, x2, y2);

        s = [];
        for (const [, p1x, p1y, p2x, p2y, ex, ey] of cubicSegments) {
          s.push(new CubicSegment(end, { x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: ex, y: ey }));
          end = { x: ex, y: ey };
        }
        break;
      }

      default:
        throw new VerifyNotReached();
    }

    dest.push(...s);
    end = s.at(-1)!.end;
  }

  return new SegmentList(dest);
};

export class Path {
  #path: RawSegment[] = [];
  #segmentList: SegmentList | undefined;

  readonly #start: Point;

  constructor(start: Point, path: RawSegment[]) {
    this.#path = path;
    this.#start = start;
  }

  static join(...paths: Path[]) {
    const dest: RawSegment[] = [];
    for (const path of paths) {
      dest.push(...path.#path);
    }
    return new Path(paths[0].start, dest);
  }

  // Note, we create the parsed segments lazily - as the path is created as edges are rerouted,
  //       but the actual segments are only needed when we want to do something with the path
  private get segmentList() {
    if (this.#segmentList) return this.#segmentList;
    this.#segmentList = makeSegmentList(this.#start, this.#path);
    return this.#segmentList;
  }

  get start() {
    return this.#start;
  }

  get end(): Point {
    return this.segmentList.segments.at(-1)!.end;
  }

  get path() {
    return this.#path;
  }

  get segmentCount() {
    return this.#segmentList ? this.#segmentList.segments.length : this.#path.length;
  }

  get segments(): ReadonlyArray<PathSegment> {
    return this.segmentList.segments;
  }

  get normalizedSegments(): ReadonlyArray<PathSegment> {
    return makeSegmentList(
      this.#start,
      this.segments.flatMap(e => e.raw())
    ).segments;
  }

  reverse() {
    const end = this.end;

    const newSegmentList: PathSegment[] = [];
    const segments = makeSegmentList(this.#start, this.#path).segments;
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      const start = s.start;
      const end = s.end;
      s.end = start;
      s.start = end;
      newSegmentList.push(s);
    }

    return new Path(
      end,
      newSegmentList.flatMap(s => s.raw())
    );
  }

  processSegments(fn: (segments: ReadonlyArray<PathSegment>) => PathSegment[]) {
    this.#segmentList = new SegmentList(fn(this.segmentList.segments));
    this.#path = this.#segmentList.segments.flatMap(e => e.raw());
  }

  length() {
    return this.segmentList.length();
  }

  pointAt(t: LengthOffsetOnPath) {
    return this.segmentList.pointAt(t);
  }

  tangentAt(t: LengthOffsetOnPath) {
    return this.segmentList.tangentAt(t);
  }

  projectPoint(point: Point): PointOnPath & LengthOffsetOnPath & TimeOffsetOnSegment {
    const projection = this.segmentList.projectPoint(point);

    return {
      pathD: projection.globalL,
      segmentT: projection.t,
      point: projection.point,
      segment: projection.segmentIndex
    };
  }

  intersections(other: Path, extend = false): ReadonlyArray<WithSegment<PointOnPath>> {
    const dest: WithSegment<PointOnPath>[] = [];

    const segments = this.segments;
    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx];
      for (const otherSegment of other.segments) {
        const intersections = segment.intersectionsWith(otherSegment, extend);
        if (!intersections) continue;
        dest.push(
          ...intersections.map(i => ({
            point: i,
            segment: idx
          }))
        );
      }
    }

    return dest;
  }

  /**
   * Note: passing a LengthOffsetOnSegment in addition as the first parameter, gives
   * quite a bit of performance boost later on
   */
  split(
    p1: TimeOffsetOnSegment | (TimeOffsetOnSegment & LengthOffsetOnSegment),
    p2?: TimeOffsetOnSegment
  ): ReadonlyArray<Path> {
    // In case both points are on the same segment, we need to split that segment into
    // three, which is a bit complicated, as we need to calculate the length offset
    if (p2 && p1.segment === p2.segment) {
      // Note: this is a bit of a weird optimization, but it gives quite a bit of
      //       performance boost when we have already calculated the length offset on the segment
      const d1 =
        (p1 as LengthOffsetOnSegment).segmentD ?? this.segments[p1.segment].lengthAtT(p1.segmentT);

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
      const [prefix, c] = this.segments[p2.segment].split(p2.segmentT);
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
    const [a, b] = this.segments[p1.segment].split(p1.segmentT);

    const dest: Path[] = [new Path(this.#start, [...this.#path.slice(0, p1.segment), ...a.raw()])];
    if (p2) {
      const [c, d] = this.segments[p2.segment].split(p2.segmentT);
      dest.push(
        new Path(b.start, [...b.raw(), ...this.#path.slice(p1.segment + 1, p2.segment), ...c.raw()])
      );
      dest.push(new Path(d.start, [...d.raw(), ...this.#path.slice(p2.segment + 1)]));
    } else {
      dest.push(new Path(b.start, [...b.raw(), ...this.#path.slice(p1.segment + 1)]));
    }
    return dest;
  }

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
      const prev = entries[i - 1];
      const current = entries[i];

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
      const entry = joinedEntries[i];

      if (entry.type === 'L') {
        dest.push(['L', entry.line.to.x, entry.line.to.y]);
      } else {
        assert.true(joinedEntries[i + 1].type === 'C');
        assert.true(joinedEntries[i + 2].type === 'C');

        const p1 = joinedEntries[i].line.to;
        const p2 = joinedEntries[i + 1].line.to;
        const end = joinedEntries[i + 2].line.to;

        dest.push(['C', p1.x, p1.y, p2.x, p2.y, end.x, end.y]);

        i += 2;
      }
    }
    return new Path(joinedEntries[0].line.from, dest);
  }

  asSvgPath() {
    // Need to resolve any T-segments, as many of the QuadSegments will
    // at this point (post processing) have turned into CubicSegment and SVG
    // cannot rended a C-segment followed by a T-segment
    const normalizedPath = this.#path.find(e => e[0] === 'T')
      ? this.segments.flatMap(e => e.raw())
      : this.#path;

    return (
      `M ${roundHighPrecision(this.#start.x)},${roundHighPrecision(this.#start.y)} ` +
      normalizedPath.map(r => this.rawSegmentAsSvgPath(r)).join(' ')
    );
  }

  bounds() {
    const boxes = this.segments.map(s => s.bounds());
    return Box.boundingBox(boxes);
  }

  hash() {
    return this.asSvgPath();
  }

  private rawSegmentAsSvgPath(r: RawSegment) {
    // We know the first element of a raw segment is the command, followed
    // by a number of numbers
    const [command, ...numbers] = r;

    const roundedNumbers = numbers.map(e => roundHighPrecision(e));
    return `${command} ${roundedNumbers.join(',')}`;
  }

  clean() {
    // Remove any repeated segments
    const dest: RawSegment[] = [this.#path[0]];
    for (let i = 1; i < this.#path.length; i++) {
      const current = this.#path[i];
      const previous = this.#path[i - 1];

      if (current.every((e, idx) => e === previous[idx])) continue;
      dest.push(current);
    }

    this.#path = dest;
    this.#segmentList = undefined;
  }

  pop() {
    const last = this.#path.pop();
    this.#segmentList = undefined;
    return last;
  }

  add(segment: RawSegment) {
    this.#path.push(segment);
    this.#segmentList = undefined;
  }
}
