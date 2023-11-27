import { Point } from './point.ts';
import { Box } from './box.ts';
import { svgPathProperties } from 'svg-path-properties';

export type Cubic = ['C', number, number, number, number, number, number];
export type Line = ['L', number, number];
export type MoveTo = ['M', number, number];
export type Arc = ['A', number, number, number, 0 | 1, 0 | 1, number, number];
export type Curve = ['T', number, number];
export type Quad = ['Q', number, number, number, number];

type Segment = Cubic | Line | MoveTo | Arc | Curve | Quad;
type NormalizedSegment = MoveTo | Cubic | Quad | Line;

export class Path {
  path: Segment[] = [];
  normalizedPath: NormalizedSegment[] = [];
  pathProperties: ReturnType<typeof svgPathProperties> | undefined;

  private getPathProperties() {
    if (!this.pathProperties) {
      this.pathProperties = new svgPathProperties(this.asSvgPath());
    }
    return this.pathProperties;
  }

  push(segment: Segment) {
    this.path.push(segment);
    this.normalizedPath = [];
    this.pathProperties = undefined;
  }

  moveTo(x: number, y: number) {
    this.push(['M', x, y]);
  }

  moveToPoint(p: Point) {
    this.push(['M', p.x, p.y]);
  }

  lineTo(x: number, y: number) {
    this.push(['L', x, y]);
  }

  lineToPoint(p: Point) {
    this.push(['L', p.x, p.y]);
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
    this.push(['A', rx, ry, angle, large_arc_flag, sweep_flag, x2, y2]);
  }

  curveTo(x: number, y: number) {
    this.push(['T', x, y]);
  }

  curveToPoint(p: Point) {
    this.push(['T', p.x, p.y]);
  }

  quadTo(x: number, y: number, x1: number, y1: number) {
    this.push(['Q', x1, y1, x, y]);
  }

  quadToPoint(p: Point, p1: Point) {
    this.push(['Q', p1.x, p1.y, p.x, p.y]);
  }

  cubicTo(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    this.push(['C', x1, y1, x2, y2, x, y]);
  }

  cubicToPoint(p: Point, p1: Point, p2: Point) {
    this.push(['C', p1.x, p1.y, p2.x, p2.y, p.x, p.y]);
  }

  positionAt(n: number) {
    const x = this.path[n][1];
    const y = this.path[n][2];
    return { x, y };
  }

  asSvgPath() {
    return this.path.map(e => e.join(' ')).join(' ');
  }

  // TODO: This should move into LocalCoordinateSystem
  toWorldCoordinate(b: Box, x: number, y: number) {
    const xPart = (x * b.size.w) / 2 + b.size.w / 2;
    const yPart = (-y * b.size.h) / 2 + b.size.h / 2;

    return { x: xPart + b.pos.x, y: yPart + b.pos.y };
  }

  append(path: Path) {
    for (const p of path.path) {
      this.push(p);
    }
  }

  length() {
    return this.getPathProperties().getTotalLength();
  }

  pointAtLength(t: number) {
    return this.getPathProperties().getPointAtLength(t);
  }
}
