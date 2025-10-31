/**
 * Local coordinate system transformations for converting between local and global coordinates.
 *
 * @example
 * ```ts
 * import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
 *
 * // Create coordinate system for a rotated node
 * const nodeBounds = { x: 100, y: 100, w: 200, h: 150, r: Math.PI / 4 };
 * const lcs = LocalCoordinateSystem.fromBox(nodeBounds);
 *
 * // Convert point from node's local coordinates to canvas coordinates
 * const localPoint = { x: 0.5, y: 0.5 }; // Center in local space
 * const globalPoint = lcs.toGlobal(localPoint);
 *
 * // Convert mouse position from canvas to node's local coordinates
 * const mousePos = { x: 250, y: 200 };
 * const localMouse = lcs.toLocal(mousePos);
 *
 * // Create coordinate system with custom ranges (e.g., for SVG viewBox)
 * const svgLcs = new LocalCoordinateSystem(
 *   nodeBounds,
 *   [0, 100],  // x range
 *   [0, 100],  // y range
 *   true       // flip Y axis
 * );
 * ```
 *
 * @module
 */

import { Box } from './box';
import { Rotation, Scale, Transform, Translation } from './transform';
import { Point } from './point';
import { VerifyNotReached } from '@diagram-craft/utils/assert';

const isBox = (c: Box | Point): c is Box => 'w' in c;
const isPoint = (c: Box | Point): c is Point => 'x' in c;

/**
 * Provides coordinate transformations between local and global coordinate systems.
 *
 * Supports translation, rotation, scaling, and Y-axis flipping for transforming
 * coordinates between different reference frames.
 *
 * Note: This provides an "unscaled" local coordinate system.
 */
export class LocalCoordinateSystem {
  /** Unity coordinate system (identity transform) */
  static UNITY = new LocalCoordinateSystem({ x: 0, y: 0, w: 1, h: 1, r: 0 });

  toGlobalTransforms: Transform[];
  toLocalTransforms: Transform[];

  /**
   * Creates a local coordinate system from a box.
   *
   * @param box - The box defining the coordinate system's position, size, and rotation
   * @returns A new LocalCoordinateSystem instance (or UNITY if box is already unity)
   */
  static fromBox(box: Box) {
    if (Point.isEqual(Point.ORIGIN, box) && box.r === 0 && box.w === 1 && box.h === 1)
      return LocalCoordinateSystem.UNITY;
    return new LocalCoordinateSystem(box);
  }

  /**
   * Creates a new local coordinate system.
   *
   * @param box - The box defining the coordinate system's position, size, and rotation
   * @param xRange - Optional X coordinate range [min, max] for scaling
   * @param yRange - Optional Y coordinate range [min, max] for scaling
   * @param flipY - Optional flag to flip the Y axis (useful for SVG coordinates)
   */
  constructor(box: Box, xRange?: [number, number], yRange?: [number, number], flipY?: boolean) {
    this.toGlobalTransforms = [];

    this.toGlobalTransforms.push(
      new Translation({
        x: xRange && xRange[0] !== 0 ? -xRange[0] : 0,
        y: yRange && yRange[0] !== 0 ? -yRange[0] : 0
      })
    );

    if (flipY) {
      const yr = yRange ? yRange[1] - yRange[0] : 1;
      this.toGlobalTransforms.push(new Scale(1, -1));
      this.toGlobalTransforms.push(new Translation({ x: 0, y: yr }));
    }

    this.toGlobalTransforms.push(
      new Scale(
        xRange ? box.w / (xRange[1] - xRange[0]) : 1,
        yRange ? box.h / (yRange[1] - yRange[0]) : 1
      )
    );

    if (box.r !== 0) this.toGlobalTransforms.push(new Rotation(box.r));

    this.toGlobalTransforms.push(new Translation(box));

    const temp = [...this.toGlobalTransforms];
    temp.reverse();
    this.toLocalTransforms = temp.map(e => e.invert());
  }

  /**
   * Transforms a point or box from local to global coordinates.
   *
   * @param c - Point or box in local coordinates
   * @returns Transformed point or box in global coordinates
   */
  toGlobal(c: Box): Box;
  toGlobal(c: Point): Point;
  toGlobal(c: Box | Point): Box | Point {
    if (isBox(c)) {
      return Transform.box(c, ...this.toGlobalTransforms);
    } else if (isPoint(c)) {
      return Transform.point(c, ...this.toGlobalTransforms);
    } else {
      throw new VerifyNotReached();
    }
  }

  /**
   * Transforms a point or box from global to local coordinates.
   *
   * @param c - Point or box in global coordinates
   * @returns Transformed point or box in local coordinates
   */
  toLocal(c: Box): Box;
  toLocal(c: Point): Point;
  toLocal(c: Box | Point): Box | Point {
    if (isBox(c)) {
      return Transform.box(c, ...this.toLocalTransforms);
    } else if (isPoint(c)) {
      return Transform.point(c, ...this.toLocalTransforms);
    } else {
      throw new VerifyNotReached();
    }
  }
}
