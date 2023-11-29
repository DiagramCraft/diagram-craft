import { Point } from './point.ts';
import { Box } from './box.ts';
import { Line } from './line.ts';
import {
  postcondition,
  precondition,
  VERIFY_NOT_REACHED,
  VerifyNotReached
} from '../utils/assert.ts';
import { BezierUtils, CubicBezier } from './bezier.ts';
import { Vector } from './vector.ts';

export type RawCubicSegment = ['C', number, number, number, number, number, number];
export type RawLineSegment = ['L', number, number];
export type RawArcSegment = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type RawCurveSegment = ['T', number, number];
export type RawQuadSegment = ['Q', number, number, number, number];

type Segment = RawCubicSegment | RawLineSegment | RawArcSegment | RawCurveSegment | RawQuadSegment;
type NormalizedSegment = RawCubicSegment | RawQuadSegment | RawLineSegment;

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

type Projection = { t: number; distance: number; point: Point };

interface PathSegment {
  length(): number;
  point(t: number): Point;
  intersectionsWith(other: PathSegment): Point[] | undefined;
  projectPoint(point: Point): Projection;
  //tangentAt(t: number): Vector;
  //normalAt(t: number): Vector;
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

  projectPoint(point: Point): Projection {
    const v = Vector.from(this.start, this.end);
    const w = Vector.from(this.start, point);

    const c1 = Vector.dot(w, v);
    const c2 = Vector.dot(v, v);

    const t = c1 / c2;

    const projection = Point.add(this.start, Vector.scale(v, t));
    const distance = Point.distance(point, projection);

    return { t, distance, point: projection };
  }

  intersectionsWith(other: PathSegment): Point[] | undefined {
    if (other instanceof LineSegment) {
      const p = Line.intersection(Line.of(this.start, this.end), Line.of(other.start, other.end));
      if (p) return [p];
      return undefined;
    } else {
      return other.intersectionsWith(this);
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

  intersectionsWith(other: PathSegment): Point[] | undefined {
    if (other instanceof LineSegment) {
      return super.intersectsLine(Line.of(other.start, other.end));
    } else if (other instanceof CubicSegment) {
      return super.intersectsBezier(other);
    } else {
      return other.intersectionsWith(this);
    }
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
  private _normalized: RawCubicSegment[] | undefined;
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

  intersectionsWith(other: PathSegment): Point[] | undefined {
    const dest: Point[] = [];

    for (const segment of this.segmentList.segments) {
      const intersections = segment.intersectionsWith(other);
      if (intersections) {
        dest.push(...intersections);
      }
    }

    return dest;
  }

  normalize(): RawCubicSegment[] {
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

  projectPoint(point: Point): Projection {
    const projection = this.segmentList.projectPoint(point);
    projection.t = projection.globalT;
    return projection;
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

  projectPoint(point: Point): Projection & { segmentIndex: number; globalT: number } {
    let bestSegment = -1;
    let bestProject: Projection | undefined;
    let bestDistance = Number.MAX_VALUE;
    const segments = this.segments;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const projection = s.projectPoint(point);
      if (projection.distance < bestDistance) {
        bestProject = projection;
        bestDistance = projection.distance;
        bestSegment = i;
      }
    }

    const l = this.segments.slice(0, bestSegment).reduce((acc, cur) => acc + cur.length(), 0);
    return {
      segmentIndex: bestSegment,
      t: bestProject!.t,
      globalT: l + bestProject!.t * this.segments[bestSegment].length(),
      distance: bestProject!.distance,
      point: bestProject!.point
    };
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

  lengthTo(idx: number) {
    return this.segments.slice(0, idx).reduce((acc, cur) => acc + cur.length(), 0);
  }

  // TODO: Change to PathPosition
  pointAtLength(t: number, _mode: Mode = 'speed') {
    return this.segmentList.pointAtLength(t, _mode);
  }

  projectPoint(point: Point): PathPosition {
    const projection = this.segmentList.projectPoint(point);

    const pathPosition = new PathPosition();
    pathPosition.globalT = projection.globalT;
    pathPosition.point = projection.point;
    pathPosition.segmentIndex = projection.segmentIndex;
    pathPosition.localT = projection.t;
    pathPosition.path = this;
    return pathPosition;
  }

  intersections(other: Path): PathPosition[] {
    const dest: PathPosition[] = [];

    for (let idx = 0; idx < this.segments.length; idx++) {
      const segment = this.segments[idx];
      for (const otherSegment of other.segments) {
        const intersections = segment.intersectionsWith(otherSegment);
        if (intersections) {
          dest.push(
            ...intersections.map(i => {
              const pos = new PathPosition();
              pos.point = i;
              pos.segmentIndex = idx;
              pos.path = this;
              return pos;
            })
          );
        }
      }
    }

    return dest;
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

export class PathPosition {
  private _globalT: number | undefined;
  private _globalD: number | undefined;
  private _point: Point | undefined;
  private _segmentIndex: number | undefined;
  private _localT: number | undefined;
  private _localD: number | undefined;
  private _path: Path | undefined;

  set path(p: Path) {
    this._path = p;

    // Check we have all we need
    postcondition.is.true(
      this._point !== undefined ||
        (this._segmentIndex !== undefined && this._localT !== undefined) ||
        (this._segmentIndex !== undefined && this._localD !== undefined) ||
        this._globalD !== undefined ||
        this._globalT !== undefined
    );
  }

  set globalT(t: number) {
    this._globalT = t;
  }

  set globalD(d: number) {
    this._globalD = d;
  }

  set point(p: Point) {
    this._point = p;
  }

  set segmentIndex(i: number) {
    this._segmentIndex = i;
  }

  set localT(t: number) {
    this._localT = t;
  }

  set localD(d: number) {
    this._localD = d;
  }

  get globalT() {
    if (this._globalT !== undefined) return this._globalT;

    if (this._globalD !== undefined) {
      this.fetchGlobalTFromGlobalD(this._globalD);
    } else if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalTFromLocalT(this._localT, this._segmentIndex);
    } else if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalTFromLocalD(this._localD, this._segmentIndex);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else {
      throw new VerifyNotReached();
    }

    return this._globalT!;
  }

  get globalD() {
    if (this._globalD !== undefined) return this._globalD;

    if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalDFromLocalD(this._localD, this._segmentIndex);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
    } else if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalDFromLocalT(this._localT, this._segmentIndex);
      this.fetchGlobalDFromLocalD(this._localD!, this._segmentIndex);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
      this.fetchGlobalDFromGlobalT(this._globalT!);
    } else {
      throw new VerifyNotReached();
    }

    return this._globalD!;
  }

  get point() {
    if (this._point !== undefined) return this._point;

    if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchPointFromLocalT(this._localT, this._segmentIndex);
    } else if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalTFromLocalD(this._localD, this._segmentIndex);
      this.fetchPointFromLocalT(this._localD!, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchPointFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchPointFromGlobalD(this._globalD!);
    } else {
      throw new VerifyNotReached();
    }

    return this._point!;
  }

  get segmentIndex() {
    if (this._segmentIndex !== undefined) return this._segmentIndex;

    if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
    } else {
      throw new VerifyNotReached();
    }

    return this._segmentIndex!;
  }

  get localT() {
    if (this._localT !== undefined) return this._localT;

    if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalTFromLocalD(this._localD, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else {
      throw new VerifyNotReached();
    }
    return this._localT!;
  }

  get localD() {
    if (this._localD !== undefined) return this._localD;

    if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalDFromLocalT(this._localT, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else {
      throw new VerifyNotReached();
    }

    return this._localD!;
  }

  private fetchGlobalDFromGlobalT(globalT: number) {
    this._globalD ??= globalT * this._path!.length();
  }

  private fetchFromPoint(p: Point) {
    const pp = this._path!.projectPoint(p);
    this._segmentIndex ??= pp.segmentIndex;
    this._localT ??= pp.localT;
    this._globalT ??= pp.globalT;
  }

  private fetchPointFromLocalT(localT: number, segmentIndex: number) {
    this._point ??= this._path!.segments[segmentIndex]!.point(localT);
  }

  private fetchLocalDFromLocalT(localT: number, segmentIndex: number) {
    this.localD ??= localT * this._path!.segments.at(segmentIndex)!.length();
  }

  private fetchGlobalTFromLocalT(localT: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    const segment = this._path!.segments.at(segmentIndex);
    const lengthOfCurrentSegment = segment!.length();

    this._localD ??= localT * lengthOfCurrentSegment;
    this._globalD ??= lb + this._localD;
    this._globalT ??= this._globalD / this._path!.length();
  }

  private fetchLocalTFromLocalD(localD: number, segmentIndex: number) {
    this._localT ??= localD / this._path!.segments[segmentIndex]!.length();
  }

  private fetchGlobalDFromLocalD(localD: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    this._globalD = lb + localD;
  }

  private fetchGlobalTFromLocalD(localD: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    this._globalD ??= lb + localD;
    this._localT ??= localD / this._path!.segments.at(segmentIndex)!.length();
    this._globalT ??= this._globalD / this._path!.length();
  }

  private fetchPointFromGlobalD(globalD: number) {
    this.point ??= this._path!.pointAtLength(globalD);
  }

  private fetchGlobalTFromGlobalD(globalD: number) {
    this._globalT ??= globalD / this._path!.length();
  }

  private fetchLocalTFromGlobalD(globalD: number) {
    let idx = 0;
    let len = 0;
    while (len < globalD) {
      len += this._path!.segments[idx]!.length();
      idx++;
    }

    this._segmentIndex ??= idx;
    this._localT ??= (len - globalD) / this._path!.segments[idx]!.length();
    this._localD ??= len - globalD;
  }
}
