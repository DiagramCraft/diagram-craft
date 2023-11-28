import { Point } from './point.ts';
import { Box } from './box.ts';
import { svgPathProperties } from 'svg-path-properties';
import { NotImplementedYet, precondition, VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { BezierUtils } from './bezier.ts';

export type Cubic = ['C', number, number, number, number, number, number];
export type Line = ['L', number, number];
export type Arc = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type Curve = ['T', number, number];
export type Quad = ['Q', number, number, number, number];

export type CubicArray = ['CA', Cubic[]];

type Segment = Cubic | Line | Arc | Curve | Quad;
type NormalizedSegment = CubicArray | Cubic | Quad | Line;

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
  pointAt(t: number): Point;
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

  pointAt(t: number) {
    return {
      x: this.start.x + (this.end.x - this.start.x) * t,
      y: this.start.y + (this.end.y - this.start.y) * t
    };
  }

  normalize(): NormalizedSegment[] {
    return [['L', this.end.x, this.end.y]];
  }
}

class CubicSegment implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    private readonly p2: Point,
    public readonly end: Point
  ) {}

  length(): number {
    throw new NotImplementedYet();
  }

  pointAt(t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return {
      x: this.start.x * mt3 + 3 * this.p1.x * mt2 * t + 3 * this.p2.x * mt * t2 + this.end.x * t3,
      y: this.start.y * mt3 + 3 * this.p1.y * mt2 * t + 3 * this.p2.y * mt * t2 + this.end.y * t3
    };
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
    throw new NotImplementedYet();
  }

  pointAt(t: number): Point {
    throw new NotImplementedYet(t.toString());
  }

  normalize(): NormalizedSegment[] {
    return BezierUtils.fromArc(
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

export class Path {
  private path: Segment[] = [];
  private pathProperties: ReturnType<typeof svgPathProperties> | undefined;
  private start: Point;
  private _pathSegments: PathSegment[] | undefined;

  constructor(path: Segment[], start: Point) {
    this.path = path;
    this.start = start;
  }

  get segments(): PathSegment[] {
    if (this._pathSegments) return this._pathSegments;

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
          s = new CurveSegment(
            lastEnd,
            { x: segment[1], y: segment[2] },
            dest.at(-1)! as QuadSegment | CurveSegment
          );
          break;
        case 'A':
          s = new ArcSegment(lastEnd, segment[1], segment[2], segment[3], segment[4], segment[5], {
            x: segment[6],
            y: segment[7]
          });
          break;

        default:
          VERIFY_NOT_REACHED();
      }
      dest.push(s!);
      lastEnd = s!.end;
    }

    this._pathSegments = dest;
    return dest;
  }

  length() {
    return this.getPathProperties().getTotalLength();
  }

  pointAtLength(t: number) {
    return this.getPathProperties().getPointAtLength(t);
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

  private getPathProperties() {
    if (!this.pathProperties) {
      this.pathProperties = new svgPathProperties(this.asSvgPath());
    }
    return this.pathProperties;
  }
}
