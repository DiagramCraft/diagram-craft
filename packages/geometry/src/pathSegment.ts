import { Point } from './point';
import { Vector } from './vector';
import { Line } from './line';
import { CubicBezier } from './bezier';
import { RawSegment } from './pathListBuilder';
import { Projection } from './path';
import { Box } from './box';
import { round } from '@diagram-craft/utils/math';

export interface Intersection {
  point: Point;
  type: 'overlap' | 'intersection';
  start?: Point;
  end?: Point;
}

type IntersectionOpts = {
  includeOverlaps?: boolean;
};

export interface PathSegment {
  length(): number;
  point(t: number): Point;
  intersectionsWith(other: PathSegment, opts?: IntersectionOpts): Intersection[];
  projectPoint(point: Point): Projection;
  raw(): RawSegment[];
  split(t: number): [PathSegment, PathSegment];
  tAtLength(length: number): number;
  lengthAtT(t: number): number;
  tangent(t: number): Vector;
  bounds(): Box;
  reverse(): PathSegment;

  start: Point;
  end: Point;
}

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

  projectPoint(point: Point): Projection {
    const px = this.end.x - this.start.x;
    const py = this.end.y - this.start.y;
    const d = px * px + py * py;
    const t = ((point.x - this.start.x) * px + (point.y - this.start.y) * py) / d;

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
        const o = Line.overlap(Line.of(this.start, this.end), Line.of(other.start, other.end));
        if (o) return [{ type: 'overlap', point: Line.midpoint(o), start: o.from, end: o.to }];
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

export class CubicSegment extends CubicBezier implements PathSegment {
  constructor(
    public readonly start: Point,
    public readonly p1: Point,
    public readonly p2: Point,
    public readonly end: Point
  ) {
    super(start, p1, p2, end);
  }

  static fromLine(s: LineSegment) {
    return new CubicSegment(
      s.start,
      Point.add(s.start, Vector.scale(Vector.from(s.start, s.end), 0.25)),
      Point.add(s.end, Vector.scale(Vector.from(s.end, s.start), 0.25)),
      s.end
    );
  }

  reverse() {
    return new CubicSegment(this.end, this.p2, this.p1, this.start);
  }

  split(t: number): [CubicSegment, CubicSegment] {
    const b = super.split(t);
    return [
      new CubicSegment(b[0].start, b[0].cp1, b[0].cp2, b[0].end),
      new CubicSegment(b[1].start, b[1].cp1, b[1].cp2, b[1].end)
    ];
  }

  bounds() {
    return this.bbox();
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
      const intersections = super.intersectsLine(line);
      // TODO: Ideally we should integrate this into the bezier algorithm
      if (!intersections || intersections.length === 0) {
        // Check for intersections with endpoints
        if (Line.isOn(this.start, line)) return [{ type: 'intersection', point: this.start }];
        if (Line.isOn(this.end, line)) return [{ type: 'intersection', point: this.end }];
      } else {
        return intersections.map(i => ({ type: 'intersection', point: i }));
      }
    } else if (other instanceof CubicSegment) {
      const intersections: Intersection[] = super
        .intersectsBezier(other)
        .map(i => ({ type: 'intersection', point: i }));
      if (opts?.includeOverlaps) {
        const overlap = super.overlap(other);
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
}
