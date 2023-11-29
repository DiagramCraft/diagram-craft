import { Point } from './point.ts';
import { Box } from './box.ts';
import { precondition, VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { BezierUtils, CubicBezier } from './bezier.ts';

export type Cubic = ['C', number, number, number, number, number, number];
export type Line = ['L', number, number];
export type Arc = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type Curve = ['T', number, number];
export type Quad = ['Q', number, number, number, number];

type Segment = Cubic | Line | Arc | Curve | Quad;
type NormalizedSegment = Cubic | Quad | Line;

type Mode = 'speed' | 'precision';

export class PathBuilder {
  path: Segment[] = [];
  start: Point | undefined;

  moveTo(x: number, y: number) {
    precondition.is.notPresent(this.start);
    this.start = { x, y };
  }

  moveToPoint(p: Point) {
    precondition.is.notPresent(this.start);
    this.start = p;
  }

  lineTo(x: number, y: number) {
    this.path.push(['L', x, y]);
  }

  lineToPoint(p: Point) {
    this.path.push(['L', p.x, p.y]);
  }

  arcTo(
    rx: number,
    ry: number,
    angle: number,
    large_arc_flag: 0 | 1,
    sweep_flag: 0 | 1,
    x2: number,
    y2: number
  ) {
    this.path.push(['A', rx, ry, angle, large_arc_flag, sweep_flag, x2, y2]);
  }

  curveTo(x: number, y: number) {
    this.path.push(['T', x, y]);
  }

  curveToPoint(p: Point) {
    this.path.push(['T', p.x, p.y]);
  }

  quadTo(x: number, y: number, x1: number, y1: number) {
    this.path.push(['Q', x1, y1, x, y]);
  }

  quadToPoint(p: Point, p1: Point) {
    this.path.push(['Q', p1.x, p1.y, p.x, p.y]);
  }

  cubicTo(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    this.path.push(['C', x1, y1, x2, y2, x, y]);
  }

  cubicToPoint(p: Point, p1: Point, p2: Point) {
    this.path.push(['C', p1.x, p1.y, p2.x, p2.y, p.x, p.y]);
  }

  // TODO: This should move into LocalCoordinateSystem
  toWorldCoordinate(b: Box, x: number, y: number) {
    const xPart = (x * b.size.w) / 2 + b.size.w / 2;
    const yPart = (-y * b.size.h) / 2 + b.size.h / 2;

    return { x: xPart + b.pos.x, y: yPart + b.pos.y };
  }

  append(path: PathBuilder) {
    for (const p of path.path) {
      this.path.push(p);
    }
  }

  getPath() {
    return new Path(this.path, this.start ?? Point.ORIGIN);
  }
}

interface PathSegment {
  length(): number;
  point(t: number): Point;
  //tangentAt(t: number): Vector;
  //normalAt(t: number): Vector;
  //intersectionsWith(other: PathSegment): Point[] | undefined;
  //boundingBox(): Box;
  //splitAt(t: number): [PathSegment, PathSegment];
  //project(p: Point): { t: number, distance: number };

  normalize(): NormalizedSegment[];

  start: Point;
  end: Point;
}

class LineSegment implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly end: Point
  ) {}

  length() {
    return Point.distance(this.start, this.end);
  }

  point(t: number) {
    return {
      x: this.start.x + (this.end.x - this.start.x) * t,
      y: this.start.y + (this.end.y - this.start.y) * t
    };
  }

  normalize(): NormalizedSegment[] {
    return [['L', this.end.x, this.end.y]];
  }
}

class CubicSegment extends CubicBezier implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    private readonly p2: Point,
    public readonly end: Point
  ) {
    super(start, p1, p2, end);
  }

  normalize(): NormalizedSegment[] {
    return [['C', this.p1.x, this.p1.y, this.p2.x, this.p2.y, this.end.x, this.end.y]];
  }
}

class QuadSegment extends CubicSegment {
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
  }

  normalize(): NormalizedSegment[] {
    return [['Q', this.p1.x, this.p1.y, this.end.x, this.end.y]];
  }
}

class ArcSegment implements PathSegment {
  private _normalized: Cubic[] | undefined;
  private _segmentList: SegmentList | undefined;

  constructor(
    public readonly start: Point,
    private readonly rx: number,
    private readonly ry: number,
    private readonly angle: number,
    private readonly large_arc_flag: 0 | 1,
    private readonly sweep_flag: 0 | 1,
    public readonly end: Point
  ) {}

  length(): number {
    return this.segmentList.length();
  }

  point(t: number): Point {
    return this.segmentList.point(t);
  }

  normalize(): Cubic[] {
    if (this._normalized) return this._normalized;

    this._normalized = BezierUtils.fromArc(
      this.start.x,
      this.start.y,
      this.rx,
      this.ry,
      this.angle,
      this.large_arc_flag,
      this.sweep_flag,
      this.end.x,
      this.end.y
    );

    return this._normalized;
  }

  private get segmentList() {
    if (this._segmentList) return this._segmentList;

    this._segmentList = new SegmentList(
      this.normalize().map(
        c =>
          new CubicSegment(
            this.start,
            { x: c[1], y: c[2] },
            { x: c[3], y: c[4] },
            { x: c[5], y: c[6] }
          )
      )
    );
    return this._segmentList;
  }
}

class CurveSegment extends QuadSegment {
  constructor(
    public readonly start: Point,
    public readonly end: Point,
    previous: QuadSegment | CurveSegment
  ) {
    const p = start;
    const cp = previous.p1!;
    const cp2 = Point.add(p, Point.subtract(p, cp));

    super(start, cp2, end);
  }
}

class SegmentList {
  constructor(public readonly segments: PathSegment[]) {}

  length() {
    return this.segments.reduce((acc, cur) => acc + cur.length(), 0) ?? 0;
  }

  point(t: number, _mode: Mode = 'speed') {
    const totalLength = this.length();
    return this.pointAtLength(t * totalLength, _mode);
  }

  pointAtLength(t: number, _mode: Mode = 'speed') {
    // Find the segment that contains the point
    let currentT = t;
    let segmentIndex = 0;
    let segment = this.segments[segmentIndex];
    while (currentT > segment.length()) {
      currentT -= segment.length();
      segment = this.segments[++segmentIndex];
    }

    // TODO: We can probably use tAtLength here
    return segment.point(currentT / segment.length());
  }
}

export class Path {
  private readonly path: Segment[] = [];
  private readonly start: Point;
  private _segmentList: SegmentList | undefined;

  constructor(path: Segment[], start: Point) {
    this.path = path;
    this.start = start;
  }

  private get segmentList() {
    if (!this._segmentList) {
      const dest: PathSegment[] = [];

      let lastEnd = this.start;

      for (const segment of this.path) {
        const command = segment[0];

        let s: PathSegment;
        switch (command) {
          case 'L':
            s = new LineSegment(lastEnd, { x: segment[1], y: segment[2] });
            break;
          case 'C':
            s = new CubicSegment(
              lastEnd,
              { x: segment[1], y: segment[2] },
              { x: segment[3], y: segment[4] },
              { x: segment[5], y: segment[6] }
            );
            break;
          case 'Q':
            s = new QuadSegment(
              lastEnd,
              { x: segment[1], y: segment[2] },
              { x: segment[3], y: segment[4] }
            );
            break;
          case 'T':
            {
              s = new CurveSegment(
                lastEnd,
                { x: segment[1], y: segment[2] },
                dest.at(-1)! as QuadSegment | CurveSegment
              );
            }
            break;
          case 'A':
            s = new ArcSegment(
              lastEnd,
              segment[1],
              segment[2],
              segment[3],
              segment[4],
              segment[5],
              {
                x: segment[6],
                y: segment[7]
              }
            );
            break;

          default:
            VERIFY_NOT_REACHED();
        }
        dest.push(s!);
        lastEnd = s!.end;
      }

      this._segmentList = new SegmentList(dest);
    }
    return this._segmentList;
  }

  get segments(): PathSegment[] {
    return this.segmentList.segments;
  }

  length() {
    return this.segmentList.length();
  }

  pointAtLength(t: number, _mode: Mode = 'speed') {
    return this.segmentList.pointAtLength(t, _mode);
  }

  asSvgPath(normalized = false) {
    if (normalized) {
      return (
        `M ${this.start.x} ${this.start.y} ` +
        this.segments
          .map(e => e.normalize())
          .flat()
          .join(' ')
      );
    } else {
      return `M ${this.start.x} ${this.start.y} ` + this.path.map(e => e.join(' ')).join(' ');
    }
  }
}
