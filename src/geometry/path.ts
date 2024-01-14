import { Point } from './point.ts';
import {
  CubicSegment,
  LineSegment,
  makeCurveSegment,
  PathSegment,
  QuadSegment,
  SegmentList
} from './pathSegment.ts';
import { VerifyNotReached } from '../utils/assert.ts';
import {
  LengthOffsetOnPath,
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from './pathPosition.ts';
import { RawSegment } from './pathBuilder.ts';
import { BezierUtils } from './bezier.ts';
import { Box } from './box.ts';

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

  // Note, we create the parsed segments lazily - as the path is created as edges are rerouted,
  //       but the actual segments are only needed when we want to do something with the path
  private get segmentList() {
    if (this.#segmentList) return this.#segmentList;
    this.#segmentList = makeSegmentList(this.#start, this.#path);
    return this.#segmentList;
  }

  get segments(): ReadonlyArray<PathSegment> {
    return this.segmentList.segments;
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

  intersections(other: Path): ReadonlyArray<WithSegment<PointOnPath>> {
    const dest: WithSegment<PointOnPath>[] = [];

    const segments = this.segments;
    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx];
      for (const otherSegment of other.segments) {
        const intersections = segment.intersectionsWith(otherSegment);
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

  asSvgPath() {
    return `M ${this.#start.x} ${this.#start.y} ` + this.#path.map(e => e.join(' ')).join(' ');
  }

  bounds() {
    const boxes = this.segments.map(s => s.bounds());
    return Box.boundingBox(boxes);
  }

  hash() {
    return this.asSvgPath();
  }
}
