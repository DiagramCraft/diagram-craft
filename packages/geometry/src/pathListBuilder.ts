import { Point } from './point';
import { Box } from './box';
import { Path } from './path';
import { Angle } from './angle';
import {
  assert,
  precondition,
  VERIFY_NOT_REACHED,
  VerifyNotReached
} from '@diagram-craft/utils/assert';
import { Transform, TransformFactory } from './transform';
import { PathUtils } from './pathUtils';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';
import { LocalCoordinateSystem } from './lcs';
import { parseSvgPath } from './svgPathUtils';

/**
 * Represents a raw cubic Bézier curve segment in an SVG path.
 *
 * @property {'C'} 0 - The command character for a cubic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the first control point.
 * @property {number} 2 - The y-coordinate of the first control point.
 * @property {number} 3 - The x-coordinate of the second control point.
 * @property {number} 4 - The y-coordinate of the second control point.
 * @property {number} 5 - The x-coordinate of the end point of the curve.
 * @property {number} 6 - The y-coordinate of the end point of the curve.
 */
export type RawCubicSegment = ['C', number, number, number, number, number, number];

/**
 * Represents a raw line segment in an SVG path.
 *
 * @property {'L'} 0 - The command character for a line segment.
 * @property {number} 1 - The x-coordinate of the end point of the line.
 * @property {number} 2 - The y-coordinate of the end point of the line.
 */
type RawLineSegment = ['L', number, number];

/**
 * Represents a raw arc segment in an SVG path.
 *
 * @property {'A'} 0 - The command character for an arc segment.
 * @property {number} 1 - The x-axis radius for the ellipse.
 * @property {number} 2 - The y-axis radius for the ellipse.
 * @property {number} 3 - The rotation angle in degrees for the ellipse's x-axis.
 * @property {0 | 1} 4 - The large-arc-flag, which determines if the arc should be greater than or less than 180 degrees.
 * @property {0 | 1} 5 - The sweep-flag, which determines if the arc should be drawn in a "positive-angle" direction or a "negative-angle" direction.
 * @property {number} 6 - The x-coordinate of the end point of the arc.
 * @property {number} 7 - The y-coordinate of the end point of the arc.
 */
type RawArcSegment = ['A', number, number, number, 0 | 1, 0 | 1, number, number];

/**
 * Represents a raw curve segment in an SVG path.
 *
 * @property {'T'} 0 - The command character for a smooth quadratic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the end point of the curve.
 * @property {number} 2 - The y-coordinate of the end point of the curve.
 */
type RawCurveSegment = ['T', number, number];

/**
 * Represents a raw quadratic Bézier curve segment in an SVG path.
 *
 * @property {'Q'} 0 - The command character for a quadratic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the control point.
 * @property {number} 2 - The y-coordinate of the control point.
 * @property {number} 3 - The x-coordinate of the end point of the curve.
 * @property {number} 4 - The y-coordinate of the end point of the curve.
 */
type RawQuadSegment = ['Q', number, number, number, number];

export type RawSegment =
  | RawCubicSegment
  | RawLineSegment
  | RawArcSegment
  | RawCurveSegment
  | RawQuadSegment;

export const translateCoordinateSystem = (b: Box) => {
  return (p: Point) => Point.add(p, b);
};

export const unitCoordinateSystem = (b: Box) => {
  const lcs = new LocalCoordinateSystem(Box.withoutRotation(b), [0, 1], [0, 1], false);
  return (p: Point) => lcs.toGlobal(p);
};

export const inverseUnitCoordinateSystem = (b: Box) => {
  return (p: Point) => ({ x: (p.x - b.x) / b.w, y: (p.y - b.y) / b.h });
};

export class PathList {
  constructor(private readonly paths: Path[]) {}

  singularPath() {
    assert.true(this.paths.length === 1, `Expected a single path, ${this.paths.length} found`);
    return this.paths[0];
  }

  all() {
    return this.paths;
  }

  bounds() {
    return Box.boundingBox(this.paths.map(p => p.bounds()));
  }

  asSvgPath() {
    return this.paths.map(p => p.asSvgPath()).join(' ');
  }

  segments() {
    return this.paths.flatMap(p => p.segments);
  }

  scale(targetBounds: Box, referenceBounds?: Box) {
    const bounds = referenceBounds ?? this.bounds();

    const t = TransformFactory.fromTo(bounds, targetBounds);

    const dest: Path[] = [];
    for (const p of this.paths) {
      const source = p.bounds();
      const target = Transform.box(source, ...t);
      dest.push(PathUtils.scalePath(p, source, target));
    }

    return new PathList(dest);
  }

  projectPoint(p: Point): { pathIdx: number; offset: TimeOffsetOnSegment & LengthOffsetOnPath } {
    let best:
      | { point: Point; pathIdx: number; offset: TimeOffsetOnSegment & LengthOffsetOnPath }
      | undefined = undefined;
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

  split(p: { pathIdx: number; offset: TimeOffsetOnSegment }): [PathList, PathList] {
    const [before, after] = this.paths[p.pathIdx].split(p.offset);

    return [
      new PathList([...this.paths.slice(0, p.pathIdx), before]),
      new PathList([after, ...this.paths.slice(p.pathIdx + 1)])
    ];
  }

  isInside(p: Point): boolean {
    const line = new Path(p, [['L', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]);
    const intersections = this.all().flatMap(p => p.intersections(line));
    return intersections.length % 2 !== 0;
  }

  isInHole(p: Point): boolean {
    const line = new Path(p, [['L', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]);
    const intersections = this.all().flatMap(p => p.intersections(line));
    return intersections.length > 1 && intersections.length % 2 === 0;
  }

  isOn(p: Point): boolean {
    for (const path of this.paths) {
      if (path.isOn(p)) return true;
    }
    return false;
  }

  intersections(p: Path): Point[] {
    return this.all()
      .flatMap(path => path.intersections(p))
      .map(i => i.point);
  }
}

type PathBuilderTransform = (p: Point) => Point;

/**
 * This represents a path part with a starting point and a number
 * of instructions
 */
type Part = {
  start: Point | undefined;
  instructions: RawSegment[];
};

export class PathListBuilder {
  private parts: Part[] = [{ start: undefined, instructions: [] }];

  private transformList: Transform[] | undefined = undefined;
  private rotation = {
    amount: 0,
    center: Point.ORIGIN
  };

  private pathCache: Path[] | undefined = undefined;

  constructor(private readonly transform: PathBuilderTransform = p => p) {}

  static fromString(path: string, transform: PathBuilderTransform = p => p) {
    const d = new PathListBuilder(transform);

    parseSvgPath(path).forEach(p => {
      const [t, ...params] = p;
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
      else throw new VerifyNotReached(`command ${t} not supported`);
    });

    return d;
  }

  private get active(): Part {
    return this.parts.at(-1)!;
  }

  moveTo(p: Point) {
    if (this.active.start) this.newSegment();
    this.active.start = this.transform(p);
    return this;
  }

  lineTo(p: Point) {
    const tp = this.transform(p);
    this.active.instructions.push(['L', tp.x, tp.y]);
    return this;
  }

  line(p1: Point, p2: Point) {
    this.moveTo(p1);
    this.lineTo(p2);
    return this;
  }

  close() {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['L', this.active.start.x, this.active.start.y]);
    return this;
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

    const g = this.transform(Point.of(rx, ry));
    const o = this.transform(Point.ORIGIN);
    const tr = Point.subtract(g, o);

    this.active.instructions.push([
      'A',
      Math.abs(tr.x),
      Math.abs(tr.y),
      angle,
      large_arc_flag,
      sweep_flag,
      tp.x,
      tp.y
    ]);
    return this;
  }

  curveTo(p: Point) {
    const tp = this.transform(p);
    this.active.instructions.push(['T', tp.x, tp.y]);
    return this;
  }

  quadTo(p: Point, p1: Point) {
    const tp = this.transform(p);
    const tp1 = this.transform(p1);
    this.active.instructions.push(['Q', tp1.x, tp1.y, tp.x, tp.y]);
    return this;
  }

  cubicTo(p: Point, p1: Point, p2: Point) {
    const tp = this.transform(p);
    const tp1 = this.transform(p1);
    const tp2 = this.transform(p2);
    this.active.instructions.push(['C', tp1.x, tp1.y, tp2.x, tp2.y, tp.x, tp.y]);
    return this;
  }

  // TODO: Is there a way to not have to need this method
  //       ... it's a bit weird that it just appends the instructions without
  //       checking that the start corresponds to the end of the previous path
  appendInstructions(path: PathListBuilder) {
    for (const p of path.active.instructions) {
      this.active.instructions.push(p);
    }
  }

  append(path: PathListBuilder) {
    for (const p of path.parts) {
      this.parts.push(p);
    }
    return this;
  }

  setRotation(rotation: number, centerOfRotation: Point) {
    this.rotation = {
      amount: rotation,
      center: centerOfRotation
    };
    this.clearCache();
  }

  setTransform(transform: Transform[]) {
    this.transformList = transform;
    this.clearCache();
    return this;
  }

  getPaths() {
    const paths = this.generatePaths();
    for (const p of paths) {
      if (!p.isClockwise()) {
        //console.warn('Path is not clockwise', sum, new Error().stack);
      }
    }

    return new PathList(paths);
  }

  private newSegment() {
    this.parts.push({ start: undefined, instructions: [] });
  }

  private clearCache() {
    this.pathCache = undefined;
  }

  private generatePaths() {
    if (this.pathCache) return this.pathCache;
    if (!this.active.start) return [];

    this.pathCache = [];
    for (const segment of this.parts) {
      if (segment.instructions.length === 0) continue;
      if (!segment.start) continue;

      const transformed = {
        instructions: this.transformList
          ? this.applyTransforms(segment.instructions)
          : segment.instructions,
        start: Transform.point(segment.start ?? Point.ORIGIN, ...(this.transformList ?? []))
      };

      const rotated = {
        start: this.applyPointRotationArray(transformed.start),
        instructions: this.applyPathRotation(transformed.instructions)
      };

      this.pathCache.push(new Path(Point.ofTuple(rotated.start), rotated.instructions));
    }

    return this.pathCache;
  }

  private applyTransform(p: Point) {
    const { x, y } = Transform.point(p, ...this.transformList!);
    return [x, y] as const;
  }

  private applyTransforms(path: RawSegment[]) {
    return path.map(s => {
      switch (s[0]) {
        case 'L':
          return ['L', ...this.applyTransform({ x: s[1], y: s[2] })] satisfies RawLineSegment;
        case 'C':
          return [
            'C',
            ...this.applyTransform({ x: s[1], y: s[2] }),
            ...this.applyTransform({ x: s[3], y: s[4] }),
            ...this.applyTransform({ x: s[5], y: s[6] })
          ] satisfies RawCubicSegment;
        case 'Q':
          return [
            'Q',
            ...this.applyTransform({ x: s[1], y: s[2] }),
            ...this.applyTransform({ x: s[3], y: s[4] })
          ] satisfies RawQuadSegment;
        case 'T':
          return ['T', ...this.applyTransform({ x: s[1], y: s[2] })] satisfies RawCurveSegment;
        case 'A':
          // TODO: Probably need to change the radiuses here as well
          return [
            'A',
            s[1],
            s[2],
            s[3],
            s[4],
            s[5],
            ...this.applyTransform({ x: s[6], y: s[7] })
          ] satisfies RawArcSegment;
        default:
          VERIFY_NOT_REACHED('Unknown path segment');
      }
    });
  }

  private applyPointRotationArray(point: Point): [number, number] {
    const np = Point.rotateAround(point, this.rotation.amount, this.rotation.center);
    return [np.x, np.y];
  }

  private applyPathRotation(path: RawSegment[]) {
    if (this.rotation.amount === 0) return path;
    return path.map(s => {
      switch (s[0]) {
        case 'L':
          return [
            'L',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] })
          ] satisfies RawLineSegment;
        case 'C':
          return [
            'C',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] }),
            ...this.applyPointRotationArray({ x: s[3], y: s[4] }),
            ...this.applyPointRotationArray({ x: s[5], y: s[6] })
          ] satisfies RawCubicSegment;
        case 'Q':
          return [
            'Q',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] }),
            ...this.applyPointRotationArray({ x: s[3], y: s[4] })
          ] satisfies RawQuadSegment;
        case 'T':
          return [
            'T',
            ...this.applyPointRotationArray({ x: s[1], y: s[2] })
          ] satisfies RawCurveSegment;
        case 'A':
          // TODO: Probably need to change the rotation parameter as well
          return [
            'A',
            s[1],
            s[2],
            s[3] + Angle.toDeg(this.rotation.amount),
            s[4],
            s[5],
            ...this.applyPointRotationArray({ x: s[6], y: s[7] })
          ] satisfies RawArcSegment;
        default:
          VERIFY_NOT_REACHED('Unknown path segment');
      }
    });
  }
}

export const PathBuilderHelper = {
  rect: (b: PathListBuilder, box: Box) => {
    b.moveTo(Point.of(box.x, box.y));
    b.lineTo(Point.of(box.x + box.w, box.y));
    b.lineTo(Point.of(box.x + box.w, box.y + box.h));
    b.lineTo(Point.of(box.x, box.y + box.h));
    b.close();
  }
};
