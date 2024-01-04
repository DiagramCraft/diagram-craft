import { Point } from './point.ts';
import { Box } from './box.ts';
import { precondition } from '../utils/assert.ts';
import { Path } from './path.ts';
import { Angle } from './angle.ts';

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
export const unitCoordinateSystem = (b: Box) => {
  return (p: Point, type?: 'point' | 'distance') => {
    if (type === 'distance') return { x: p.x * b.w, y: p.y * b.h };

    const xPart = (p.x * b.w) / 2 + b.w / 2;
    const yPart = (-p.y * b.h) / 2 + b.h / 2;

    return { x: xPart + b.x, y: yPart + b.y };
  };
};

export class PathBuilder {
  private start: Point | undefined;
  private path: RawSegment[] = [];
  private rotation: number = 0;
  private centerOfRotation: Point = Point.ORIGIN;

  constructor(
    private readonly transform: (p: Point, type?: 'point' | 'distance') => Point = p => p
  ) {}

  moveTo(p: Point) {
    precondition.is.notPresent(this.start);
    this.start = this.transform(p);
  }

  lineTo(p: Point) {
    const tp = this.transform(p);
    this.path.push(['L', tp.x, tp.y]);
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

  getPath() {
    return new Path(
      Point.ofTuple(this.applyPointRotationArray(this.start ?? Point.ORIGIN)),
      this.applyPathRotation(this.path)
    );
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
