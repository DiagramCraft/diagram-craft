import { Point } from './point';
import { Box } from './box';
import { Path } from './path';
import {
  assert,
  precondition,
  VERIFY_NOT_REACHED,
  VerifyNotReached
} from '@diagram-craft/utils/assert';
import { Transform, TransformFactory, Translation } from './transform';
import { parseSvgPath } from './svgPathUtils';
import { PathList } from './pathList';
import { Lazy } from '@diagram-craft/utils/lazy';

/**
 * Represents a raw cubic Bézier curve segment in an SVG path.
 *
 * @property {'C'} 0 - The command character for a cubic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the first control point.
 * @property {number} 2 - The y-coordinate of the first control point.
 * @property {number} 3 - The x-coordinate of the second control point.
 * @property {number} 4 - The y-coordinate of the second control point.
 * @property {number} 5 - The x-coordinate of the curve endpoint.
 * @property {number} 6 - The y-coordinate of the curve endpoint.
 */
export type RawCubicSegment = ['C', number, number, number, number, number, number];

/**
 * Represents a raw line segment in an SVG path.
 *
 * @property {'L'} 0 - The command character for a line segment.
 * @property {number} 1 - The x-coordinate of the line endpoint.
 * @property {number} 2 - The y-coordinate of the line endpoint.
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
 * @property {number} 6 - The x-coordinate of the arc endpoint.
 * @property {number} 7 - The y-coordinate of the arc endpoint.
 */
type RawArcSegment = ['A', number, number, number, 0 | 1, 0 | 1, number, number];

/**
 * Represents a raw curve segment in an SVG path.
 *
 * @property {'T'} 0 - The command character for a smooth quadratic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the curve endpoint.
 * @property {number} 2 - The y-coordinate of the curve endpoint.
 */
type RawCurveSegment = ['T', number, number];

/**
 * Represents a raw quadratic Bézier curve segment in an SVG path.
 *
 * @property {'Q'} 0 - The command character for a quadratic Bézier curve segment.
 * @property {number} 1 - The x-coordinate of the control point.
 * @property {number} 2 - The y-coordinate of the control point.
 * @property {number} 3 - The x-coordinate of the curve endpoint
 * @property {number} 4 - The y-coordinate of the curve endpoint.
 */
type RawQuadSegment = ['Q', number, number, number, number];

export type RawSegment =
  | RawCubicSegment
  | RawLineSegment
  | RawArcSegment
  | RawCurveSegment
  | RawQuadSegment;

export const translateCoordinateSystem = (b: Box) => {
  return [new Translation(b)];
};

export const unitCoordinateSystem = (b: Box) => {
  return TransformFactory.fromTo({ x: 0, y: 0, w: 1, h: 1, r: 0 }, Box.withoutRotation(b));
};

export const inverseUnitCoordinateSystem = (b: Box) => {
  return TransformFactory.fromTo(b, { x: 0, y: 0, w: 1, h: 1, r: 0 });
};

type RawPath = {
  start: Point | undefined;
  instructions: RawSegment[];
};

export class PathListBuilder {
  private readonly rawPaths: RawPath[] = [{ start: undefined, instructions: [] }];
  private readonly pathCache = new Lazy<Path[]>(() => {
    if (!this.active.start) return new Lazy.NoCache([]);

    return this._getPaths(this.transformList ?? []);
  });

  private transformList: Transform[] | undefined = undefined;

  static fromSegments(start: Point, instructions: RawSegment[]) {
    const d = new PathListBuilder();
    d.moveTo(start);
    for (const instruction of instructions) {
      d.appendInstruction(instruction);
    }
    return d;
  }

  static fromString(path: string, transforms?: Transform[]) {
    const d = new PathListBuilder();
    if (transforms) d.withTransform(transforms);

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
      else throw new VerifyNotReached(`command ${t} not supported: ${path}`);
    });

    return d;
  }

  get active(): RawPath {
    return this.rawPaths.at(-1)!;
  }

  get pathCount() {
    return this.rawPaths.length;
  }

  get activeInstructionCount() {
    return this.active.instructions.length;
  }

  bounds() {
    return Box.boundingBox(this.pathCache.get().map(p => p.bounds()));
  }

  moveTo(p: Point) {
    if (this.active.start) this.newSegment();
    this.active.start = p;
    return this;
  }

  lineTo(p: Point) {
    this.active.instructions.push(['L', p.x, p.y]);
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
    this.active.instructions.push([
      'A',
      Math.abs(rx),
      Math.abs(ry),
      angle,
      large_arc_flag,
      sweep_flag,
      p.x,
      p.y
    ]);
    return this;
  }

  curveTo(p: Point) {
    this.active.instructions.push(['T', p.x, p.y]);
    return this;
  }

  quadTo(p: Point, p1: Point) {
    this.active.instructions.push(['Q', p1.x, p1.y, p.x, p.y]);
    return this;
  }

  cubicTo(p: Point, p1: Point, p2: Point) {
    this.active.instructions.push(['C', p1.x, p1.y, p2.x, p2.y, p.x, p.y]);
    return this;
  }

  appendInstruction(instruction: RawSegment) {
    this.active.instructions.push(instruction);
  }

  popInstruction() {
    this.active.instructions.pop();
  }

  append(path: PathListBuilder) {
    for (const p of path.rawPaths) {
      this.rawPaths.push(p);
    }
    return this;
  }

  reverse() {
    return PathListBuilder.fromString(
      this.getPaths()
        .all()
        .map(path => path.reverse().asSvgPath())
        .join(' ')
    );
  }

  withTransform(transform: Transform[]) {
    assert.true(!this.transformList || this.transformList.length === 0);
    this.transformList = transform;
    this.pathCache.clear();
    return this;
  }

  addTransform(transform: Transform | Transform[]) {
    this.transformList ??= [];
    if (Array.isArray(transform)) {
      this.transformList.push(...transform);
    } else {
      this.transformList.push(transform);
    }
    this.pathCache.clear();
    return this;
  }

  getPaths(transforms?: Transform[]) {
    const paths = transforms ? this._getPaths(transforms) : this.pathCache.get();
    /*for (const p of paths) {
      if (!p.isClockwise()) {
        //console.warn('Path is not clockwise', sum, new Error().stack);
      }
    }*/

    return new PathList(paths);
  }

  private _getPaths(transforms: Transform[]): Path[] {
    const dest: Path[] = [];
    for (const segment of this.rawPaths) {
      if (segment.instructions.length === 0) continue;
      if (!segment.start) continue;

      const transformed = {
        instructions:
          transforms.length > 0
            ? this.applyTransforms(segment.instructions, transforms)
            : segment.instructions,
        start: Transform.point(segment.start ?? Point.ORIGIN, ...transforms)
      };

      dest.push(new Path(transformed.start, transformed.instructions));
    }

    return dest;
  }

  private newSegment() {
    this.rawPaths.push({ start: undefined, instructions: [] });
  }

  private transformPoint(p: Point, transforms: Transform[]) {
    const { x, y } = Transform.point(p, ...transforms);
    return [x, y] as const;
  }

  private applyTransforms(path: RawSegment[], transforms: Transform[]) {
    return path.map(s => {
      switch (s[0]) {
        case 'L':
          return [
            'L',
            ...this.transformPoint({ x: s[1], y: s[2] }, transforms)
          ] satisfies RawLineSegment;
        case 'C':
          return [
            'C',
            ...this.transformPoint({ x: s[1], y: s[2] }, transforms),
            ...this.transformPoint({ x: s[3], y: s[4] }, transforms),
            ...this.transformPoint({ x: s[5], y: s[6] }, transforms)
          ] satisfies RawCubicSegment;
        case 'Q':
          return [
            'Q',
            ...this.transformPoint({ x: s[1], y: s[2] }, transforms),
            ...this.transformPoint({ x: s[3], y: s[4] }, transforms)
          ] satisfies RawQuadSegment;
        case 'T':
          return [
            'T',
            ...this.transformPoint({ x: s[1], y: s[2] }, transforms)
          ] satisfies RawCurveSegment;
        case 'A': {
          const g = this.transformPoint(Point.of(s[1], s[2]), transforms);
          const o = this.transformPoint(Point.ORIGIN, transforms);
          const radii = Point.subtract(Point.ofTuple(g), Point.ofTuple(o));
          const target = this.transformPoint({ x: s[6], y: s[7] }, transforms);

          return [
            'A',
            Math.abs(radii.x),
            Math.abs(radii.y),
            s[3],
            s[4],
            s[5],
            ...target
          ] satisfies RawArcSegment;
        }
        default:
          VERIFY_NOT_REACHED('Unknown path segment');
      }
    });
  }

  toString() {
    return this.rawPaths
      .map(r => `M ${r.start!.x} ${r.start!.y} ${r.instructions.join(' ')}`)
      .join(', ');
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
