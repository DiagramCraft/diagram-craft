import { Point } from './point.ts';
import { Box } from './box.ts';
import { precondition } from '../utils/assert.ts';
import { Path } from './path.ts';

export type RawCubicSegment = ['C', number, number, number, number, number, number];
export type RawLineSegment = ['L', number, number];
export type RawArcSegment = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type RawCurveSegment = ['T', number, number];
export type RawQuadSegment = ['Q', number, number, number, number];

export type Segment =
  | RawCubicSegment
  | RawLineSegment
  | RawArcSegment
  | RawCurveSegment
  | RawQuadSegment;

export class PathBuilder {
  path: Segment[] = [];
  start: Point | undefined;
  private rotation: number = 0;
  private centerOfRotation: Point = Point.ORIGIN;

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
  /* This translates from a unit coordinate system (-1<x<1, -1<y<1) to a world coordinate system */
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

  setRotation(rotation: number, centerOfRotation: Point) {
    this.rotation = rotation;
    this.centerOfRotation = centerOfRotation;
  }

  getPath() {
    return new Path(
      this.applyPathRotation(this.path),
      this.applyPointRotation(this.start ?? Point.ORIGIN)
    );
  }

  private applyPointRotation(point: Point) {
    return Point.rotateAround(point, this.rotation, this.centerOfRotation);
  }

  private applyPointRotationArray(point: Point) {
    const np = Point.rotateAround(point, this.rotation, this.centerOfRotation);
    return [np.x, np.y];
  }

  private applyPathRotation(path: Segment[]) {
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
          return [
            'A',
            s[1],
            s[2],
            s[3],
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
