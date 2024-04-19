import { Point } from './point';
import { Box } from './box';
import { Path } from './path';
import { Angle } from './angle';
import { assert, precondition, VerifyNotReached } from '@diagram-craft/utils/assert';
import { Transform, TransformFactory } from './transform';
import { PathUtils } from './pathUtils';
import { TimeOffsetOnSegment } from './pathPosition';

export type RawCubicSegment = ['C', number, number, number, number, number, number];
export type RawLineSegment = ['L', number, number];
export type RawArcSegment = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type RawCurveSegment = ['T', number, number];
export type RawQuadSegment = ['Q', number, number, number, number];

export type RawSegment =
  | RawCubicSegment
  | RawLineSegment
  | RawArcSegment
  | RawCurveSegment
  | RawQuadSegment;

/* This translates from a unit coordinate system (-1<x<1, -1<y<1) to a world coordinate system */
export const unitCoordinateSystem = (b: Box, invert = true) => {
  return (p: Point, type?: 'point' | 'distance') => {
    if (type === 'distance') return { x: p.x * b.w, y: p.y * b.h };

    const xPart = (p.x * b.w) / 2 + b.w / 2;
    const yPart = ((invert ? -1 : 1) * (p.y * b.h)) / 2 + b.h / 2;

    return { x: xPart + b.x, y: yPart + b.y };
  };
};

const posZero = (n: number) => (n === 0 ? 0 : n);

export const inverseUnitCoordinateSystem = (b: Box, invert = true) => {
  return (p: Point, type?: 'point' | 'distance') => {
    if (type === 'distance') return { x: p.x / b.w, y: p.y / b.h };

    const xPart = p.x - b.x;
    const yPart = p.y - b.y;

    return {
      x: posZero((xPart / b.w) * 2 - 1),
      y: posZero((invert ? -1 : 1) * ((yPart / b.h) * 2 - 1))
    };
  };
};

export class CompoundPath {
  constructor(private readonly paths: Path[]) {}

  singularPath() {
    assert.true(this.paths.length === 1, 'Expected a single path');
    return this.paths[0];
  }

  all() {
    return this.paths;
  }

  bounds() {
    return Box.boundingBox(this.paths.map(p => p.bounds()));
  }

  asSvgPath() {
    return this.paths.map(p => p.asSvgPath()).join(', ');
  }

  segments() {
    return this.paths.flatMap(p => p.segments);
  }

  scale(targetBounds: Box) {
    const bounds = this.bounds();

    const t = TransformFactory.fromTo(bounds, targetBounds);

    const dest: Path[] = [];
    for (const p of this.paths) {
      const source = p.bounds();
      const target = Transform.box(source, ...t);
      dest.push(PathUtils.scalePath(p, source, target));
    }

    return new CompoundPath(dest);
  }

  projectPoint(p: Point): { pathIdx: number; offset: TimeOffsetOnSegment } {
    let best: { point: Point; pathIdx: number; offset: TimeOffsetOnSegment } | undefined =
      undefined;
    for (let idx = 0; idx < this.paths.length; idx++) {
      const path = this.paths[idx];
      const bp = path.projectPoint(p);
      if (best === undefined || Point.distance(p, bp.point) < Point.distance(p, best.point)) {
        best = {
          point: bp.point,
          pathIdx: idx,
          offset: bp
        };
      }
    }

    return best!;
  }

  split(p: { pathIdx: number; offset: TimeOffsetOnSegment }): [CompoundPath, CompoundPath] {
    const [before, after] = this.paths[p.pathIdx].split(p.offset);

    return [
      new CompoundPath([...this.paths.slice(0, p.pathIdx), before]),
      new CompoundPath([after, ...this.paths.slice(p.pathIdx + 1)])
    ];
  }
}

type PathBuilderTransform = (p: Point, type?: 'point' | 'distance') => Point;

export class PathBuilder {
  private start: Point | undefined;
  private path: RawSegment[] = [];
  private rotation: number = 0;
  private centerOfRotation: Point = Point.ORIGIN;

  private paths: Path[] = [];

  constructor(private readonly transform: PathBuilderTransform = p => p) {}

  static fromString(path: string, transform: PathBuilderTransform = p => p) {
    const d = new PathBuilder(transform);
    const parts = path.split(',');
    parts.forEach(p => {
      const [t, ...params] = p.trim().split(' ');
      const pn = params.map(p => parseFloat(p));

      // TODO: Support relative instructions
      //       Support z
      if (t === 'M') d.moveTo({ x: pn[0], y: pn[1] });
      else if (t === 'L') d.lineTo({ x: pn[0], y: pn[1] });
      else if (t === 'C')
        d.cubicTo({ x: pn[4], y: pn[5] }, { x: pn[0], y: pn[1] }, { x: pn[2], y: pn[3] });
      else if (t === 'Q') d.quadTo({ x: pn[2], y: pn[3] }, { x: pn[0], y: pn[1] });
      else if (t === 'T') d.curveTo({ x: pn[0], y: pn[1] });
      else if (t === 'A')
        d.arcTo({ x: pn[5], y: pn[6] }, pn[0], pn[1], pn[2], pn[3] as 0 | 1, pn[4] as 0 | 1);
      else throw new VerifyNotReached();
    });

    return d;
  }

  moveTo(p: Point) {
    if (this.start) this.flushPath();
    this.start = this.transform(p);
  }

  lineTo(p: Point) {
    const tp = this.transform(p);
    this.path.push(['L', tp.x, tp.y]);
  }

  close() {
    precondition.is.present(this.start);
    this.path.push(['L', this.start.x, this.start.y]);
  }

  arcTo(
    p: Point,
    rx: number,
    ry: number,
    angle: number = 0,
    large_arc_flag: 0 | 1 = 0,
    sweep_flag: 0 | 1 = 0
  ) {
    const tp = this.transform(p);
    const tr = this.transform({ x: rx, y: ry }, 'distance');

    this.path.push(['A', tr.x, tr.y, angle, large_arc_flag, sweep_flag, tp.x, tp.y]);
  }

  curveTo(p: Point) {
    const tp = this.transform(p);
    this.path.push(['T', tp.x, tp.y]);
  }

  quadTo(p: Point, p1: Point) {
    const tp = this.transform(p);
    const tp1 = this.transform(p1);
    this.path.push(['Q', tp1.x, tp1.y, tp.x, tp.y]);
  }

  cubicTo(p: Point, p1: Point, p2: Point) {
    const tp = this.transform(p);
    const tp1 = this.transform(p1);
    const tp2 = this.transform(p2);
    this.path.push(['C', tp1.x, tp1.y, tp2.x, tp2.y, tp.x, tp.y]);
  }

  append(path: PathBuilder) {
    for (const p of path.path) {
      this.path.push(p);
    }
  }

  setRotation(rotation: number, centerOfRotation: Point) {
    this.rotation = rotation;
    this.centerOfRotation = centerOfRotation;
  }

  getPaths() {
    this.flushPath();
    return new CompoundPath(this.paths);
  }

  private flushPath() {
    if (!this.start) return;

    this.paths.push(
      new Path(
        Point.ofTuple(this.applyPointRotationArray(this.start ?? Point.ORIGIN)),
        this.applyPathRotation(this.path)
      )
    );

    this.start = undefined;
    this.path = [];
  }

  private applyPointRotationArray(point: Point): [number, number] {
    const np = Point.rotateAround(point, this.rotation, this.centerOfRotation);
    return [np.x, np.y];
  }

  private applyPathRotation(path: RawSegment[]) {
    return path.map(s => {
      switch (s[0]) {
        case 'L':
          return ['L', ...this.applyPointRotationArray({ x: s[1], y: s[2] })] as RawLineSegment;
        case 'C':
          return [
            'C',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] }),
            ...this.applyPointRotationArray({ x: s[3], y: s[4] }),
            ...this.applyPointRotationArray({ x: s[5], y: s[6] })
          ] as RawCubicSegment;
        case 'Q':
          return [
            'Q',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] }),
            ...this.applyPointRotationArray({ x: s[3], y: s[4] })
          ] as RawQuadSegment;
        case 'T':
          return ['T', ...this.applyPointRotationArray({ x: s[1], y: s[2] })] as RawCurveSegment;
        case 'A':
          // TODO: Probably need to change the rotation parameter as well
          return [
            'A',
            s[1],
            s[2],
            s[3] + Angle.toDeg(this.rotation),
            s[4],
            s[5],
            ...this.applyPointRotationArray({ x: s[6], y: s[7] })
          ] as RawArcSegment;
        default:
          throw new Error('Unknown path segment');
      }
    });
  }
}

export const PathBuilderHelper = {
  rect: (b: PathBuilder, box: Box) => {
    b.moveTo(Point.of(box.x, box.y));
    b.lineTo(Point.of(box.x + box.w, box.y));
    b.lineTo(Point.of(box.x + box.w, box.y + box.h));
    b.lineTo(Point.of(box.x, box.y + box.h));
    b.close();
  }
};
