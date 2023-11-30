import { Point } from './point.ts';
import { Vector } from './vector.ts';
import { Line } from './line.ts';
import { BezierUtils, CubicBezier } from './bezier.ts';
import { RawCubicSegment, RawLineSegment, RawQuadSegment, Segment } from './pathBuilder.ts';
import { Accuracy, Projection } from './path.ts';
import { LengthOffsetOnPath } from './pathPosition.ts';
import { NotImplementedYet } from '../utils/assert.ts';

type NormalizedSegment = RawCubicSegment | RawQuadSegment | RawLineSegment;

export interface PathSegment {
  length(): number;
  point(t: number): Point;
  intersectionsWith(other: PathSegment): Point[] | undefined;
  projectPoint(point: Point): Projection;
  asRawSegments(): Segment[];
  split(t: number): [PathSegment, PathSegment];
  //tangentAt(t: number): Vector;
  //normalAt(t: number): Vector;
  //boundingBox(): Box;
  //splitAt(t: number): [PathSegment, PathSegment];
  //project(p: Point): { t: number, distance: number };

  normalize(): NormalizedSegment[];

  start: Point;
  end: Point;
}

export class LineSegment implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly end: Point
  ) {}

  asRawSegments(): Segment[] {
    return [['L', this.end.x, this.end.y]];
  }

  split(t: number): [PathSegment, PathSegment] {
    const p = this.point(t);
    return [new LineSegment(this.start, p), new LineSegment(p, this.end)];
  }

  projectPoint(point: Point): Projection {
    const v = Vector.from(this.start, this.end);
    const w = Vector.from(this.start, point);

    const c1 = Vector.dot(w, v);
    const c2 = Vector.dot(v, v);

    const t = c1 / c2;

    const projection = Point.add(this.start, Vector.scale(v, t));
    const distance = Point.distance(point, projection);

    return {
      t,
      distance,
      point: projection
    };
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

export class CubicSegment extends CubicBezier implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    private readonly p2: Point,
    public readonly end: Point
  ) {
    super(start, p1, p2, end);
  }

  split(t: number): [CubicSegment, CubicSegment] {
    const b = super.split(t);
    return [
      new CubicSegment(b[0].start, b[0].cp1, b[0].cp2, b[0].end),
      new CubicSegment(b[1].start, b[1].cp1, b[1].cp2, b[1].end)
    ];
  }

  asRawSegments(): Segment[] {
    return [['C', this.p1.x, this.p1.y, this.p2.x, this.p2.y, this.end.x, this.end.y]];
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

export const makeCurveSegment = (start: Point, end: Point, previous: QuadSegment): CubicSegment => {
  const p = start;
  const cp = previous.p1!;
  const cp2 = Point.add(p, Point.subtract(p, cp));

  return new QuadSegment(start, cp2, end);
};

export class QuadSegment extends CubicSegment {
  quadP1: Point;

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

  normalize(): NormalizedSegment[] {
    return [['Q', this.p1.x, this.p1.y, this.end.x, this.end.y]];
  }
}

export class ArcSegment implements PathSegment {
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

  asRawSegments(): Segment[] {
    return this._segmentList?.segments.flatMap(s => s.asRawSegments()) ?? [];
  }

  length(): number {
    return this.segmentList.length();
  }

  point(t: number): Point {
    return this.segmentList.point(t);
  }

  // @ts-ignore
  split(_t: number) {
    // TODO: Implement this - maybe this can be implemented without looking at the bezier curves
    throw new NotImplementedYet();
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
    projection.t = projection.globalL / this.length();
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

export class SegmentList {
  constructor(public readonly segments: PathSegment[]) {}

  length() {
    return this.segments.reduce((acc, cur) => acc + cur.length(), 0) ?? 0;
  }

  point(t: number, _mode: Accuracy = 'speed') {
    const totalLength = this.length();
    return this.pointAt({ pathD: t * totalLength }, _mode);
  }

  pointAt(t: LengthOffsetOnPath, _mode: Accuracy = 'speed') {
    // Find the segment that contains the point
    let currentD = t.pathD;
    let segmentIndex = 0;
    let segment = this.segments[segmentIndex];
    while (currentD > segment.length()) {
      currentD -= segment.length();
      segment = this.segments[++segmentIndex];
    }

    // TODO: We can probably use tAtLength here
    return segment.point(currentD / segment.length());
  }

  projectPoint(point: Point): Projection & { segmentIndex: number; globalL: number } {
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
      globalL: l + bestProject!.t * this.segments[bestSegment].length(),
      distance: bestProject!.distance,
      point: bestProject!.point
    };
  }
}
