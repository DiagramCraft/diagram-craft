/**
 * Builder for constructing paths programmatically with support for transformations and SVG parsing.
 *
 * PathListBuilder provides a fluent API for creating complex paths from lines, curves, and arcs.
 * It supports transformations, SVG path parsing, and multiple path segments.
 *
 * @example
 * ```ts
 * import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
 *
 * // Build a simple rectangle
 * const rect = new PathListBuilder()
 *   .moveTo({ x: 0, y: 0 })
 *   .lineTo({ x: 100, y: 0 })
 *   .lineTo({ x: 100, y: 100 })
 *   .lineTo({ x: 0, y: 100 })
 *   .close();
 *
 * // Build a path with curves
 * const curve = new PathListBuilder()
 *   .moveTo({ x: 0, y: 50 })
 *   .cubicTo({ x: 100, y: 50 }, { x: 25, y: 0 }, { x: 75, y: 100 });
 *
 * // Parse from SVG path string
 * const fromSvg = PathListBuilder.fromString('M 0 0 L 100 100 C 150 150 200 200 250 250');
 *
 * // Apply transformations
 * const scaled = new PathListBuilder()
 *   .moveTo({ x: 0, y: 0 })
 *   .lineTo({ x: 10, y: 10 })
 *   .withTransform(TransformFactory.scale(2, 2));
 *
 * // Get the result as a PathList
 * const paths = rect.getPaths();
 * ```
 *
 * @module
 */

import { Point } from './point';
import { Box } from './box';
import { Path } from './path';
import {
  assert,
  precondition,
  VERIFY_NOT_REACHED,
  VerifyNotReached
} from '@diagram-craft/utils/assert';
import { Transform, TransformFactory } from './transform';
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

/**
 * Union type representing all possible raw path segment types.
 *
 * This includes lines, cubic curves, quadratic curves, smooth curves, and arcs.
 */
export type RawSegment =
  | RawCubicSegment
  | RawLineSegment
  | RawArcSegment
  | RawCurveSegment
  | RawQuadSegment;

type RawPath = {
  start: Point | undefined;
  instructions: RawSegment[];
};

/**
 * Creates a transformation from unit local coordinate system (0,0 to 1,1) to a box's coordinate system.
 *
 * This is useful for mapping normalized coordinates to actual pixel coordinates within a box.
 * The rotation of the box is disregarded.
 *
 * @param b The target box
 * @returns Array of transforms to apply
 */
export const fromUnitLCS = (b: Box) =>
  TransformFactory.fromTo({ x: 0, y: 0, w: 1, h: 1, r: 0 }, Box.withoutRotation(b));

/**
 * Creates a transformation from a box's coordinate system to unit local coordinate system (0,0 to 1,1).
 *
 * This is useful for normalizing coordinates from actual pixel coordinates to a unit coordinate space.
 * The resulting unit box has dimensions w: 1, h: 1, is positioned at x: 0, y: 0,
 * and has a rotation of r: 0 in local coordinate space.
 *
 * @param b The source box
 * @returns Array of transforms to apply
 */
export const toUnitLCS = (b: Box) => TransformFactory.fromTo(b, { x: 0, y: 0, w: 1, h: 1, r: 0 });

/**
 * Builder for constructing paths with a fluent API.
 *
 * Provides methods for creating paths from scratch or parsing SVG path strings,
 * with support for transformations and multiple path segments.
 */
export class PathListBuilder {
  private readonly rawPaths: RawPath[] = [{ start: undefined, instructions: [] }];
  private readonly pathCache = new Lazy<Path[]>(() => {
    if (!this.active.start) return new Lazy.NoCache([]);

    return this._getPaths(this.transformList ?? []);
  });

  private transformList: Transform[] | undefined = undefined;

  /**
   * Creates a PathListBuilder from an existing PathList.
   *
   * @param pathList The path list to convert
   * @returns A new PathListBuilder instance
   */
  static fromPathList(pathList: PathList) {
    return PathListBuilder.fromString(pathList.asSvgPath());
  }

  /**
   * Creates a PathListBuilder from an existing Path.
   *
   * @param path The path to convert
   * @returns A new PathListBuilder instance
   */
  static fromPath(path: Path) {
    return PathListBuilder.fromSegments(
      path.start,
      path.segments.flatMap(s => s.raw())
    );
  }

  /**
   * Creates a PathListBuilder from a starting point and raw segment instructions.
   *
   * @param start The starting point of the path
   * @param instructions Array of raw segment instructions
   * @returns A new PathListBuilder instance
   */
  static fromSegments(start: Point, instructions: RawSegment[]) {
    const d = new PathListBuilder();
    d.moveTo(start);
    for (const instruction of instructions) {
      d.appendInstruction(instruction);
    }
    return d;
  }

  /**
   * Creates a PathListBuilder by parsing an SVG path string.
   *
   * Supports standard SVG path commands: M/m (move), L/l (line), H/h (horizontal line),
   * V/v (vertical line), C/c (cubic curve), S/s (smooth cubic curve), Q/q (quadratic curve),
   * T/t (smooth quadratic curve), A/a (arc), and Z/z (close path).
   * Uppercase commands use absolute coordinates, lowercase use relative coordinates.
   *
   * @param path The SVG path string to parse
   * @returns A new PathListBuilder instance
   */
  static fromString(path: string) {
    const d = new PathListBuilder();
    let currentPos: Point = { x: 0, y: 0 };
    let lastControlPoint: Point | undefined;
    let lastCommand: string | undefined;

    parseSvgPath(path).forEach(p => {
      const [t, ...params] = p;
      const pn = params.map(p => parseFloat(p));

      switch (t) {
        case 'M':
          currentPos = { x: pn[0]!, y: pn[1]! };
          d.moveTo(currentPos);
          break;
        case 'm':
          currentPos = { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! };
          d.moveTo(currentPos);
          break;
        case 'L':
          currentPos = { x: pn[0]!, y: pn[1]! };
          d.lineTo(currentPos);
          break;
        case 'l':
          currentPos = { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! };
          d.lineTo(currentPos);
          break;
        case 'H':
          currentPos = { x: pn[0]!, y: currentPos.y };
          d.lineTo(currentPos);
          break;
        case 'h':
          currentPos = { x: currentPos.x + pn[0]!, y: currentPos.y };
          d.lineTo(currentPos);
          break;
        case 'V':
          currentPos = { x: currentPos.x, y: pn[0]! };
          d.lineTo(currentPos);
          break;
        case 'v':
          currentPos = { x: currentPos.x, y: currentPos.y + pn[0]! };
          d.lineTo(currentPos);
          break;
        case 'C':
          lastControlPoint = { x: pn[2]!, y: pn[3]! };
          currentPos = { x: pn[4]!, y: pn[5]! };
          d.cubicTo(currentPos, { x: pn[0]!, y: pn[1]! }, lastControlPoint);
          break;
        case 'c':
          lastControlPoint = { x: currentPos.x + pn[2]!, y: currentPos.y + pn[3]! };
          d.cubicTo(
            { x: currentPos.x + pn[4]!, y: currentPos.y + pn[5]! },
            { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! },
            lastControlPoint
          );
          currentPos = { x: currentPos.x + pn[4]!, y: currentPos.y + pn[5]! };
          break;
        case 'S': {
          // Calculate reflected control point
          const p1 =
            lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's'
              ? { x: 2 * currentPos.x - lastControlPoint!.x, y: 2 * currentPos.y - lastControlPoint!.y }
              : currentPos;
          lastControlPoint = { x: pn[0]!, y: pn[1]! };
          currentPos = { x: pn[2]!, y: pn[3]! };
          d.cubicTo(currentPos, p1, lastControlPoint);
          break;
        }
        case 's': {
          // Calculate reflected control point
          const p1 =
            lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's'
              ? { x: 2 * currentPos.x - lastControlPoint!.x, y: 2 * currentPos.y - lastControlPoint!.y }
              : currentPos;
          lastControlPoint = { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! };
          currentPos = { x: currentPos.x + pn[2]!, y: currentPos.y + pn[3]! };
          d.cubicTo(currentPos, p1, lastControlPoint);
          break;
        }
        case 'Q':
          currentPos = { x: pn[2]!, y: pn[3]! };
          d.quadTo(currentPos, { x: pn[0]!, y: pn[1]! });
          break;
        case 'q':
          d.quadTo(
            { x: currentPos.x + pn[2]!, y: currentPos.y + pn[3]! },
            { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! }
          );
          currentPos = { x: currentPos.x + pn[2]!, y: currentPos.y + pn[3]! };
          break;
        case 'T':
          currentPos = { x: pn[0]!, y: pn[1]! };
          d.curveTo(currentPos);
          break;
        case 't':
          currentPos = { x: currentPos.x + pn[0]!, y: currentPos.y + pn[1]! };
          d.curveTo(currentPos);
          break;
        case 'A':
          currentPos = { x: pn[5]!, y: pn[6]! };
          d.arcTo(currentPos, pn[0]!, pn[1]!, pn[2], pn[3] as 0 | 1, pn[4] as 0 | 1);
          break;
        case 'a':
          currentPos = { x: currentPos.x + pn[5]!, y: currentPos.y + pn[6]! };
          d.arcTo(currentPos, pn[0]!, pn[1]!, pn[2], pn[3] as 0 | 1, pn[4] as 0 | 1);
          break;
        case 'Z':
        case 'z':
          d.close();
          if (d.active.start) {
            currentPos = d.active.start;
          }
          break;
        default:
          throw new VerifyNotReached(`command ${t} not supported: ${path}`);
      }

      // Track the last command for smooth curve commands
      lastCommand = t;
    });

    return d;
  }

  /**
   * Gets the currently active path being built.
   *
   * @returns The active raw path
   */
  get active(): RawPath {
    return this.rawPaths.at(-1)!;
  }

  /**
   * Gets the number of paths in this builder.
   *
   * @returns The path count
   */
  get pathCount() {
    return this.rawPaths.length;
  }

  /**
   * Gets the number of instructions in the currently active path.
   *
   * @returns The instruction count
   */
  get activeInstructionCount() {
    return this.active.instructions.length;
  }

  /**
   * Calculates the bounding box of all paths.
   *
   * @returns A box containing all paths
   */
  bounds() {
    return Box.boundingBox(this.pathCache.get().map(p => p.bounds()));
  }

  /**
   * Moves to a new point, starting a new sub-path if necessary.
   *
   * If the active path already has a start point, this creates a new path segment.
   *
   * @param p The point to move to
   * @returns This builder (for chaining)
   */
  moveTo(p: Point) {
    if (this.active.start) this.newSegment();
    this.active.start = p;
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds a line segment to the specified point.
   *
   * @param p The endpoint of the line
   * @returns This builder (for chaining)
   */
  lineTo(p: Point) {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['L', p.x, p.y]);
    this.pathCache.clear();
    return this;
  }

  /**
   * Creates a line from one point to another.
   *
   * Equivalent to moveTo(p1).lineTo(p2).
   *
   * @param p1 The starting point
   * @param p2 The ending point
   * @returns This builder (for chaining)
   */
  line(p1: Point, p2: Point) {
    this.moveTo(p1);
    this.lineTo(p2);
    return this;
  }

  /**
   * Closes the current path by adding a line back to the start point.
   *
   * @returns This builder (for chaining)
   */
  close() {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['L', this.active.start.x, this.active.start.y]);
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds an elliptical arc segment to the specified point.
   *
   * @param p The endpoint of the arc
   * @param rx The x-axis radius of the ellipse
   * @param ry The y-axis radius of the ellipse
   * @param angle The rotation angle in degrees for the ellipse's x-axis
   * @param large_arc_flag Determines if the arc should be greater than 180 degrees (1) or not (0)
   * @param sweep_flag Determines if the arc is drawn in positive-angle (1) or negative-angle (0) direction
   * @returns This builder (for chaining)
   */
  arcTo(
    p: Point,
    rx: number,
    ry: number,
    angle: number = 0,
    large_arc_flag: 0 | 1 = 0,
    sweep_flag: 0 | 1 = 0
  ) {
    precondition.is.present(this.active.start);
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
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds a smooth quadratic curve segment to the specified point.
   *
   * The control point is reflected from the previous segment's control point.
   *
   * @param p The endpoint of the curve
   * @returns This builder (for chaining)
   */
  curveTo(p: Point) {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['T', p.x, p.y]);
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds a quadratic Bézier curve segment to the specified point.
   *
   * @param p The endpoint of the curve
   * @param p1 The control point
   * @returns This builder (for chaining)
   */
  quadTo(p: Point, p1: Point) {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['Q', p1.x, p1.y, p.x, p.y]);
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds a cubic Bézier curve segment to the specified point.
   *
   * @param p The endpoint of the curve
   * @param p1 The first control point
   * @param p2 The second control point
   * @returns This builder (for chaining)
   */
  cubicTo(p: Point, p1: Point, p2: Point) {
    precondition.is.present(this.active.start);
    this.active.instructions.push(['C', p1.x, p1.y, p2.x, p2.y, p.x, p.y]);
    this.pathCache.clear();
    return this;
  }

  /**
   * Appends a raw segment instruction to the active path.
   *
   * @param instruction The raw segment instruction to append
   */
  appendInstruction(instruction: RawSegment) {
    this.active.instructions.push(instruction);
    this.pathCache.clear();
  }

  /**
   * Removes the last instruction from the active path.
   */
  popInstruction() {
    this.active.instructions.pop();
    this.pathCache.clear();
  }

  /**
   * Appends all paths from another PathListBuilder to this builder.
   *
   * @param path The PathListBuilder to append
   * @returns This builder (for chaining)
   */
  append(path: PathListBuilder) {
    for (const p of path.rawPaths) {
      this.rawPaths.push(p);
    }
    this.pathCache.clear();
    return this;
  }

  /**
   * Creates a new PathListBuilder with all paths reversed.
   *
   * @returns A new PathListBuilder with reversed paths
   */
  reverse() {
    return PathListBuilder.fromString(
      this.getPaths()
        .all()
        .map(path => path.reverse().asSvgPath())
        .join(' ')
    );
  }

  /**
   * Sets the transformation to apply to all paths.
   *
   * Replaces any existing transformations. Use addTransform to append transformations.
   *
   * @param transform Array of transforms to apply
   * @returns This builder (for chaining)
   */
  withTransform(transform: Transform[]) {
    assert.true(!this.transformList || this.transformList.length === 0);
    this.transformList = transform;
    this.pathCache.clear();
    return this;
  }

  /**
   * Adds one or more transformations to the existing transformation list.
   *
   * @param transform A single transform or array of transforms to add
   * @returns This builder (for chaining)
   */
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

  /**
   * Gets the constructed paths as a PathList.
   *
   * Applies any configured transformations to the paths before returning them.
   *
   * @param transforms Optional transforms to apply (overrides configured transforms)
   * @returns A PathList containing the constructed paths
   */
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

  /**
   * Converts the builder to a string representation.
   *
   * Useful for debugging and inspecting the raw path data.
   *
   * @returns String representation of all paths
   */
  toString() {
    return this.rawPaths
      .map(r => `M ${r.start!.x} ${r.start!.y} ${r.instructions.join(' ')}`)
      .join(', ');
  }
}

/**
 * Helper functions for common path construction patterns.
 *
 * @namespace
 */
export const PathBuilderHelper = {
  /**
   * Adds a rectangle to the builder.
   *
   * Creates a closed rectangular path using the specified box dimensions.
   *
   * @param b The PathListBuilder to add the rectangle to
   * @param box The box defining the rectangle's position and size
   */
  rect: (b: PathListBuilder, box: Box) => {
    b.moveTo(Point.of(box.x, box.y));
    b.lineTo(Point.of(box.x, box.y + box.h));
    b.lineTo(Point.of(box.x + box.w, box.y + box.h));
    b.lineTo(Point.of(box.x + box.w, box.y));
    b.close();
  }
};
