import { Point } from './point';
import { RawCubicSegment } from './pathListBuilder';
import { Box } from './box';
import { Line } from './line';
import { Vector } from './vector';
import { Angle } from './angle';
import { isSame, round } from '@diagram-craft/utils/math';
import { smallestIndex } from '@diagram-craft/utils/array';

const PI = Math.PI;
const PI_2 = Math.PI * 2;
const PI_4 = Math.PI * 4;
const RADIANS_120 = (PI * 120) / 180;

const EPSILON = 0.001;

const rotate = (x: number, y: number, rad: number): Point => {
  const cosr = Math.cos(rad);
  const sinr = Math.sin(rad);
  return { x: x * cosr - y * sinr, y: x * sinr + y * cosr };
};

// See https://pomax.github.io/bezierinfo/legendre-gauss.html
// using n=25
const W = [
  0.1231760537267154, 0.12224244299031, 0.12224244299031, 0.1194557635357848, 0.1194557635357848,
  0.1148582591457116, 0.1148582591457116, 0.1085196244742637, 0.1085196244742637,
  0.1005359490670506, 0.1005359490670506, 0.0910282619829637, 0.0910282619829637, 0.080140700335001,
  0.080140700335001, 0.0680383338123569, 0.0680383338123569, 0.0549046959758352, 0.0549046959758352,
  0.0409391567013063, 0.0409391567013063, 0.0263549866150321, 0.0263549866150321,
  0.0113937985010263, 0.0113937985010263
] as const;

const X = [
  0.0, -0.1228646926107104, 0.1228646926107104, -0.2438668837209884, 0.2438668837209884,
  -0.3611723058093879, 0.3611723058093879, -0.473002731445715, 0.473002731445715,
  -0.5776629302412229, 0.5776629302412229, -0.6735663684734684, 0.6735663684734684,
  -0.7592592630373576, 0.7592592630373576, -0.833442628760834, 0.833442628760834,
  -0.8949919978782753, 0.8949919978782753, -0.9429745712289743, 0.9429745712289743,
  -0.9766639214595175, 0.9766639214595175, -0.9955569697904981, 0.9955569697904981
] as const;

const VALID_EXTREMES = (e: number) => e >= 0 && e <= 1;

const sgn = (a: number) => (a >= 0 ? 1 : -1);

// Based on https://gist.github.com/weepy/6009631
const cubicRoots = (a: number, b: number, c: number, d: number) => {
  if (isSame(a, 0)) return quadraticRoots(b, c, d);

  const bq = b / a;
  const cq = c / a;
  const dq = d / a;

  const bq_2 = bq * bq;
  const q = (3 * cq - bq_2) / 9;
  const r = (9 * bq * cq - 27 * dq - 2 * bq * bq_2) / 54;

  const q_3 = q * q * q;
  const discriminator = q_3 + r * r;

  const bq_d3 = bq / 3;

  if (discriminator >= 0) {
    // One real root and three imaginary roots
    const dsqrt = Math.sqrt(discriminator);
    const s = sgn(r + dsqrt) * Math.cbrt(Math.abs(r + dsqrt));
    const t = sgn(r - dsqrt) * Math.cbrt(Math.abs(r - dsqrt));

    return [-bq_d3 + (s + t)];
  } else {
    // Three real roots
    const th = Math.acos(r / Math.sqrt(-q_3));

    const qs = 2 * Math.sqrt(-q);
    return [
      qs * Math.cos(th / 3) - bq_d3,
      qs * Math.cos((th + PI_2) / 3) - bq_d3,
      qs * Math.cos((th + PI_4) / 3) - bq_d3
    ];
  }
};

// Basically an implementation of https://en.wikipedia.org/wiki/Quadratic_formula
const quadraticRoots = (a: number, b: number, c: number) => {
  const d = b * b - 4 * a * c;
  if (d < 0) {
    return [];
  } else if (d === 0) {
    return [-b / (2 * a)];
  } else {
    const sqd = Math.sqrt(d);
    return [(-b + sqd) / (2 * a), (-b - sqd) / (2 * a)];
  }
};

export const BezierUtils = {
  // For more information of where this Math came from visit:
  // http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
  fromArc: (
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    angle: number,
    large_arc_flag: 0 | 1,
    sweep_flag: 0 | 1,
    x2: number,
    y2: number,
    recursive?: [number, number, number, number] | undefined
  ): RawCubicSegment[] => {
    const rad = Angle.toRad(angle);

    if (!rx || !ry) {
      return [['C', x1, y1, x2, y2, x2, y2]];
    }

    let f1: number;
    let f2: number;
    let cx: number;
    let cy: number;

    if (recursive) {
      [f1, f2, cx, cy] = recursive;
    } else {
      const rot1 = rotate(x1, y1, -rad);
      x1 = rot1.x;
      y1 = rot1.y;

      const rot2 = rotate(x2, y2, -rad);
      x2 = rot2.x;
      y2 = rot2.y;

      const x = (x1 - x2) / 2;
      const y = (y1 - y2) / 2;

      const h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (h > 1) {
        const hSq = Math.sqrt(h);
        rx = hSq * rx;
        ry = hSq * ry;
      }

      const rx2 = rx * rx;
      const ry2 = ry * ry;
      const k =
        (large_arc_flag === sweep_flag ? -1 : 1) *
        Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));

      cx = (k * rx * y) / ry + (x1 + x2) / 2;
      cy = (k * -ry * x) / rx + (y1 + y2) / 2;

      f1 = Math.asin(Number(((y1 - cy) / ry).toFixed(9)));
      f2 = Math.asin(Number(((y2 - cy) / ry).toFixed(9)));

      f1 = x1 < cx ? PI - f1 : f1;
      f2 = x2 < cx ? PI - f2 : f2;
      f1 < 0 && (f1 = PI * 2 + f1);
      f2 < 0 && (f2 = PI * 2 + f2);

      if (sweep_flag && f1 > f2) {
        f1 -= PI * 2;
      }
      if (!sweep_flag && f2 > f1) {
        f2 -= PI * 2;
      }
    }

    const res: RawCubicSegment[] = [];

    if (Math.abs(f2 - f1) > RADIANS_120) {
      const f2old = f2;
      const x2old = x2;
      const y2old = y2;

      f2 = f1 + RADIANS_120 * (sweep_flag && f2 > f1 ? 1 : -1);
      x2 = cx + rx * Math.cos(f2);
      y2 = cy + ry * Math.sin(f2);
      res.push(
        ...BezierUtils.fromArc(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [
          f2,
          f2old,
          cx,
          cy
        ])
      );
    }

    const t = Math.tan((f2 - f1) / 4);
    const hx = (4 / 3) * rx * t;
    const hy = (4 / 3) * ry * t;

    const m2 = [x1 - hx * Math.sin(f1), y1 + hy * Math.cos(f1)];
    const m3 = [x2 + hx * Math.sin(f2), y2 - hy * Math.cos(f2)];
    const m4 = [x2, y2];

    if (recursive) {
      return [['C', m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], ...res];
    } else {
      const flattened = [['C', m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], ...res].flat();

      const dest: RawCubicSegment[] = [];
      for (let i = 0; i < flattened.length; i += 7) {
        dest.push([
          'C',
          rotate(flattened[i + 1] as number, flattened[i + 2] as number, rad).x,
          rotate(flattened[i + 1] as number, flattened[i + 2] as number, rad).y,
          rotate(flattened[i + 3] as number, flattened[i + 4] as number, rad).x,
          rotate(flattened[i + 3] as number, flattened[i + 4] as number, rad).y,
          rotate(flattened[i + 5] as number, flattened[i + 6] as number, rad).x,
          rotate(flattened[i + 5] as number, flattened[i + 6] as number, rad).y
        ] as RawCubicSegment);
      }
      return dest;
    }
  },

  qubicFromThreePoints: (start: Point, pointOnPath: Point, end: Point): Point => {
    const B = pointOnPath;
    const d1 = Point.distance(start, B);
    const d2 = Point.distance(end, B);

    const t = d1 / (d1 + d2);
    const t1 = 1 - t;

    const ratio = Math.abs((t * t + t1 * t1 - 1) / (t * t + t1 * t1));
    const ut = (t1 * t1) / (t * t + t1 * t1);

    const C = Point.add(Vector.scale(start, ut), Vector.scale(end, 1 - ut));
    return Point.add(B, Vector.scale(Point.subtract(B, C), 1 / ratio));
  }
};

const recurseIntersection = (c1: CubicBezier, c2: CubicBezier, threshold: number): Point[] => {
  const c1b = c1.bbox();
  const c2b = c2.bbox();
  if (Math.max(c1b.w, c1b.h, c2b.w, c2b.h) < threshold) return [c2b];

  const cc1 = c1.split(0.5);
  const cc2 = c2.split(0.5);

  const results: Point[] = [];
  if (cc1[0].bboxIntersects(cc2[0])) {
    results.push(...recurseIntersection(cc1[0], cc2[0], threshold));
  }
  if (cc1[0].bboxIntersects(cc2[1])) {
    results.push(...recurseIntersection(cc1[0], cc2[1], threshold));
  }
  if (cc1[1].bboxIntersects(cc2[1])) {
    results.push(...recurseIntersection(cc1[1], cc2[1], threshold));
  }
  if (cc1[1].bboxIntersects(cc2[0])) {
    results.push(...recurseIntersection(cc1[1], cc2[0], threshold));
  }

  return results;
  /*if (results.length <= 1) return results;

  const d: Point[] = [];
  const arr = results;

  for (let i = 0; i < arr.length; i++) {
    if (d.find(e => Point.squareDistance(e, arr[i]) < 2)) {
      continue;
    }
    d.push(arr[i]);
  }

  return d;*/
};

export class CubicBezier {
  #dp1: Point;
  #dp2: Point;
  #dp3: Point;

  #bbox: Box | undefined;
  #length: number | undefined;

  constructor(
    public readonly start: Point,
    public readonly cp1: Point,
    public readonly cp2: Point,
    public readonly end: Point
  ) {
    this.#dp1 = { x: (cp1.x - start.x) * 3, y: (cp1.y - start.y) * 3 };
    this.#dp2 = { x: (cp2.x - cp1.x) * 3, y: (cp2.y - cp1.y) * 3 };
    this.#dp3 = { x: (end.x - cp2.x) * 3, y: (end.y - cp2.y) * 3 };
  }

  point(t: number) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return {
      x: this.start.x * mt3 + 3 * this.cp1.x * mt2 * t + 3 * this.cp2.x * mt * t2 + this.end.x * t3,
      y: this.start.y * mt3 + 3 * this.cp1.y * mt2 * t + 3 * this.cp2.y * mt * t2 + this.end.y * t3
    };
  }

  sample(n = 100, start = 0, end = 1): ReadonlyArray<Point> {
    const d = end - start;
    const points: Array<Point> = [];
    for (let i = 0; i <= n; i++) {
      points.push(this.point(start + (d * i) / n));
    }
    return points;
  }

  split(t: number): [CubicBezier, CubicBezier] {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const m = {
      x: this.start.x * mt3 + 3 * this.cp1.x * mt2 * t + 3 * this.cp2.x * mt * t2 + this.end.x * t3,
      y: this.start.y * mt3 + 3 * this.cp1.y * mt2 * t + 3 * this.cp2.y * mt * t2 + this.end.y * t3
    };
    return [
      new CubicBezier(
        this.start,
        {
          x: this.start.x * mt + this.cp1.x * t,
          y: this.start.y * mt + this.cp1.y * t
        },
        {
          x: this.start.x * mt2 + 2 * this.cp1.x * t * mt + this.cp2.x * t2,
          y: this.start.y * mt2 + 2 * this.cp1.y * t * mt + this.cp2.y * t2
        },
        m
      ),
      new CubicBezier(
        m,
        {
          x: this.cp1.x * mt2 + 2 * this.cp2.x * t * mt + this.end.x * t2,
          y: this.cp1.y * mt2 + 2 * this.cp2.y * t * mt + this.end.y * t2
        },
        {
          x: this.cp2.x * mt + this.end.x * t,
          y: this.cp2.y * mt + this.end.y * t
        },
        this.end
      )
    ];
  }

  derivative(t: number) {
    const mt = 1 - t;
    return {
      x: mt * mt * this.#dp1.x + 2 * mt * t * this.#dp2.x + t * t * this.#dp3.x,
      y: mt * mt * this.#dp1.y + 2 * mt * t * this.#dp2.y + t * t * this.#dp3.y
    };
  }

  tangent(t: number) {
    const d = this.derivative(t);
    const l = Math.sqrt(d.x * d.x + d.y * d.y);
    return { x: d.x / l, y: d.y / l };
  }

  normal(t: number) {
    const d = this.derivative(t);
    const l = Math.sqrt(d.x * d.x + d.y * d.y);
    return { x: -d.y / l, y: d.x / l };
  }

  extreme() {
    const a_x = this.#dp1.x - 2 * this.#dp2.x + this.#dp3.x;
    const a_y = this.#dp1.y - 2 * this.#dp2.y + this.#dp3.y;
    const b_x = 2 * this.#dp2.x - 2 * this.#dp1.x;
    const b_y = 2 * this.#dp2.y - 2 * this.#dp1.y;
    const roots_x = quadraticRoots(a_x, b_x, this.#dp1.x).filter(VALID_EXTREMES);
    const roots_y = quadraticRoots(a_y, b_y, this.#dp1.y).filter(VALID_EXTREMES);

    return { x: roots_x, y: roots_y };
  }

  bbox() {
    if (this.#bbox) return this.#bbox;

    const extreme = this.extreme();

    if (extreme.x.length === 0 && extreme.y.length === 0) {
      this.#bbox = Box.fromCorners(this.start, this.end);
      return this.#bbox;
    }

    const x = [this.start.x, ...extreme.x.map(t => this.point(t).x), this.end.x];
    const y = [this.start.y, ...extreme.y.map(t => this.point(t).y), this.end.y];

    const mx = Math.min(...x);
    const my = Math.min(...y);

    this.#bbox = {
      x: mx,
      y: my,
      w: Math.max(...x) - mx,
      h: Math.max(...y) - my,
      r: 0
    };

    return this.#bbox;
  }

  coarseBbox() {
    const minX = Math.min(this.start.x, this.cp1.x, this.cp2.x, this.end.x);
    const maxX = Math.max(this.start.x, this.cp1.x, this.cp2.x, this.end.x);
    const minY = Math.min(this.start.y, this.cp1.y, this.cp2.y, this.end.y);
    const maxY = Math.max(this.start.y, this.cp1.y, this.cp2.y, this.end.y);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, r: 0 };
  }

  length() {
    if (this.#length) return this.#length;

    const z = 0.5;

    let sum = 0;
    for (let i = 0; i < X.length; i++) {
      sum += W[i] * this.darclen(z * X[i] + z);
    }

    this.#length = z * sum;
    return this.#length;
  }

  tAtLength(l: number) {
    const len = this.length() / 2; // this.#length ?? 1000;

    let total = 0;
    let prevSample = this.point(0);
    for (let i = 1; i < len; i++) {
      const sample = this.point(i / len);
      const d = Point.distance(prevSample, sample);
      prevSample = sample;

      total += d;
      if (total >= l) {
        // interpolate between the last sample and the current sample
        const t = (l - (total - d)) / d;
        return (i - 1 + t) / len;
      }
    }
    return 1;
  }

  lengthAtT(t: number) {
    return this.split(t)[0].length();
  }

  bboxIntersects(other: CubicBezier) {
    return (
      // Note, not entirely sure if this is 100% correct, but as far as I can understand,
      //       a cubic bezier is bounded by its control points.
      //       Since calculating a tight bounding box is quite expensive, it's beneficial
      //       to first check the simple and coarse bounding box
      Box.intersects(this.coarseBbox(), other.coarseBbox()) &&
      Box.intersects(this.bbox(), other.bbox())
    );
  }

  intersectsBezier(other: CubicBezier, threshold = 0.1) {
    if (!this.bboxIntersects(other)) return [];

    const results = recurseIntersection(this, other, threshold);
    if (results.length <= 1) return results;

    const d: Point[] = [];
    for (const item of results) {
      if (d.find(e => Point.squareDistance(e, item) < 2)) {
        continue;
      }
      d.push(item);
    }

    return d.length === 0 ? undefined : d;
  }

  intersectsLine(line: Line) {
    const min_x = Math.min(line.from.x, line.to.x);
    const max_x = Math.max(line.from.x, line.to.x);
    const min_y = Math.min(line.from.y, line.to.y);
    const max_y = Math.max(line.from.y, line.to.y);

    const lineBbox = { x: min_x, y: min_y, w: max_x - min_x, h: max_y - min_y, r: 0 };
    if (!Box.intersects(this.coarseBbox(), lineBbox)) {
      return [];
    }

    const Ax = 3 * (this.cp1.x - this.cp2.x) + this.end.x - this.start.x;
    const Ay = 3 * (this.cp1.y - this.cp2.y) + this.end.y - this.start.y;

    const Bx = 3 * (this.start.x - 2 * this.cp1.x + this.cp2.x);
    const By = 3 * (this.start.y - 2 * this.cp1.y + this.cp2.y);

    const Cx = 3 * (this.cp1.x - this.start.x);
    const Cy = 3 * (this.cp1.y - this.start.y);

    const Dx = this.start.x;
    const Dy = this.start.y;

    const vx = line.to.y - line.from.y;
    const vy = line.from.x - line.to.x;

    const d = line.from.x * vx + line.from.y * vy;

    const roots = cubicRoots(
      vx * Ax + vy * Ay,
      vx * Bx + vy * By,
      vx * Cx + vy * Cy,
      vx * Dx + vy * Dy - d
    );

    const res = [];
    for (const t of roots) {
      if (isNaN(t) || t < 0 || t > 1) continue;

      const p = {
        x: ((Ax * t + Bx) * t + Cx) * t + Dx,
        y: ((Ay * t + By) * t + Cy) * t + Dy
      };

      // Note, we used to apply rounding before checking this, but it's slow
      //       and unclear if it's actually needed
      if (p.x < min_x - EPSILON || p.x > max_x + EPSILON) continue;
      if (p.y < min_y - EPSILON || p.y > max_y + EPSILON) continue;
      res.push(p);
    }

    return res.length === 0 ? undefined : res;
  }

  projectPoint(p: Point): { distance: number; t: number; point: Point } {
    const samples = this.sample(25);
    let smallestIdx = smallestIndex(samples.map(s => Point.squareDistance(p, s)));

    let maxIter = 100;

    let v: number;
    let t1 = Math.max(0, smallestIdx - 1) / samples.length;
    let t2 = Math.min(samples.length - 1, smallestIdx + 1) / samples.length;
    while ((v = t2 - t1) > 0.001 && --maxIter > 0) {
      const subsamples = [
        this.point(t1),
        this.point(t1 + 0.25 * v),
        this.point(t1 + 0.5 * v),
        this.point(t1 + 0.75 * v),
        this.point(t2)
      ];

      smallestIdx = smallestIndex(subsamples.map(s => Point.squareDistance(p, s)));

      t1 = t1 + (v * Math.max(0, smallestIdx - 1)) / subsamples.length;
      t2 = t1 + (v * Math.min(subsamples.length - 1, smallestIdx + 1)) / subsamples.length;
    }

    const pp = this.point(t1);
    return { distance: Point.distance(pp, p), t: t1, point: pp };
  }

  private darclen(t: number) {
    const d = this.derivative(t);
    return Math.sqrt(d.x * d.x + d.y * d.y);
  }
}
