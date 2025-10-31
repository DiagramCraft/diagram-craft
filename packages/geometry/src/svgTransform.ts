/**
 * SVG transformation utilities for building and applying 2D transformations.
 *
 * This module provides classes for building complex SVG transformations using a fluent API,
 * converting them to transformation matrices, and applying them to points. Supports translation,
 * rotation, and scaling operations.
 *
 * @example
 * ```ts
 * import { SvgTransformBuilder } from '@diagram-craft/geometry/svgTransform';
 *
 * // Build a simple transformation
 * const transform = new SvgTransformBuilder()
 *   .translate(10, 20)
 *   .rotate(45)
 *   .scale(2)
 *   .build();
 *
 * // Transform a point
 * const point = { x: 10, y: 10 };
 * const transformed = transform.transformPoint(point);
 *
 * // Get SVG string representation
 * const svgString = transform.asSvgString();
 * // Result: "matrix(1.414,1.414,-1.414,1.414,10,20)"
 *
 * // Build transformation around a center point
 * const center = { x: 50, y: 50 };
 * const centered = new SvgTransformBuilder(center)
 *   .rotate(90)
 *   .scale(1.5)
 *   .build();
 *
 * // Rotate around a specific point
 * const rotated = new SvgTransformBuilder()
 *   .rotate(45, 100, 100)
 *   .build();
 * ```
 *
 * @module
 */

import type { Point } from './point';

/**
 * Represents a single transformation operation.
 */
interface TransformOperation {
  /** The type of transformation */
  type: 'translate' | 'rotate' | 'scale';
  /** The numeric parameters for the transformation */
  values: number[];
}

/**
 * Represents a 2D affine transformation matrix in the form [a, b, c, d, e, f].
 *
 * Corresponds to the matrix:
 * ```
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 * ```
 *
 * Where (e, f) is translation, and the 2x2 submatrix handles rotation/scale/skew.
 */
type TransformationMatrix = [number, number, number, number, number, number];

/**
 * Multiplies two transformation matrices.
 *
 * Matrix multiplication is used to combine multiple transformations into a single matrix.
 * The order matters: m1 * m2 applies m2 first, then m1.
 *
 * @param m1 The first transformation matrix
 * @param m2 The second transformation matrix
 * @returns The resulting transformation matrix
 */
const multiply = (m1: TransformationMatrix, m2: TransformationMatrix): TransformationMatrix => {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2
  ];
};

/**
 * Builder for constructing SVG transformations with a fluent API.
 *
 * Allows chaining transformation operations (translate, rotate, scale) and
 * optionally applying them around a specific center point.
 *
 * @example
 * ```ts
 * // Simple transformation chain
 * const transform = new SvgTransformBuilder()
 *   .translate(100, 50)
 *   .rotate(45)
 *   .scale(2)
 *   .build();
 *
 * // Transform around a center point
 * const centered = new SvgTransformBuilder({ x: 50, y: 50 })
 *   .rotate(90)
 *   .build();
 * ```
 */
export class SvgTransformBuilder {
  private operations: TransformOperation[] = [];

  /**
   * Creates a new transformation builder.
   *
   * @param center Optional center point for transformations. When provided, all transformations
   *               will be applied relative to this center point (translate to origin, transform, translate back).
   */
  constructor(private readonly center?: Point) {
    if (center) {
      this.translate(center.x, center.y);
    }
  }

  /**
   * Adds a translation transformation.
   *
   * @param x The x-axis translation distance
   * @param y The y-axis translation distance
   * @returns This builder for chaining
   */
  translate(x: number, y: number) {
    this.operations.push({ type: 'translate', values: [x, y] });
    return this;
  }

  /**
   * Adds a rotation transformation.
   *
   * @param angle The rotation angle in degrees
   * @param cx Optional x-coordinate of the center of rotation
   * @param cy Optional y-coordinate of the center of rotation
   * @returns This builder for chaining
   *
   * @example
   * ```ts
   * // Rotate around origin
   * builder.rotate(45);
   *
   * // Rotate around a specific point
   * builder.rotate(45, 100, 100);
   * ```
   */
  rotate(angle: number, cx?: number, cy?: number) {
    if (cx !== undefined && cy !== undefined && cx !== 0 && cy !== 0) {
      this.operations.push({ type: 'rotate', values: [angle, cx, cy] });
    } else {
      this.operations.push({ type: 'rotate', values: [angle] });
    }
    return this;
  }

  /**
   * Adds a scale transformation.
   *
   * @param sx The x-axis scale factor
   * @param sy Optional y-axis scale factor (defaults to sx for uniform scaling)
   * @returns This builder for chaining
   *
   * @example
   * ```ts
   * // Uniform scaling
   * builder.scale(2);
   *
   * // Non-uniform scaling
   * builder.scale(2, 1.5);
   * ```
   */
  scale(sx: number, sy?: number) {
    this.operations.push({ type: 'scale', values: sy !== undefined ? [sx, sy] : [sx] });
    return this;
  }

  /**
   * Builds and returns the final transformation.
   *
   * If a center point was provided in the constructor, this method adds the final
   * translation to move back from the center.
   *
   * @returns A new SvgTransform instance with all operations applied
   */
  build() {
    if (this.center) this.translate(-this.center.x, -this.center.y);
    return new SvgTransform(this.operations);
  }
}

/**
 * Represents a compiled SVG transformation as a matrix.
 *
 * This class converts a sequence of transformation operations into a single
 * transformation matrix and provides methods to apply it to points or convert
 * it to an SVG string.
 *
 * @example
 * ```ts
 * const transform = new SvgTransform([
 *   { type: 'translate', values: [10, 20] },
 *   { type: 'rotate', values: [45] }
 * ]);
 *
 * const point = { x: 10, y: 10 };
 * const transformed = transform.transformPoint(point);
 * ```
 */
export class SvgTransform {
  /** The compiled transformation matrix in the form [a, b, c, d, e, f] */
  matrix: TransformationMatrix;

  /**
   * Creates a new SVG transformation from a sequence of operations.
   *
   * The operations are applied in reverse order (right-to-left) and combined
   * into a single transformation matrix.
   *
   * @param operations Array of transformation operations to apply
   */
  constructor(operations: TransformOperation[] = []) {
    this.matrix = [1, 0, 0, 1, 0, 0];

    for (const op of operations.reverse()) {
      this.applyOperation(op);
    }
  }

  /**
   * Applies a single transformation operation to the matrix.
   *
   * @param op The transformation operation to apply
   */
  private applyOperation(op: TransformOperation) {
    let opMatrix: TransformationMatrix;

    switch (op.type) {
      case 'translate': {
        const [x, y] = op.values as [number, number];
        opMatrix = [1, 0, 0, 1, x, y];
        break;
      }
      case 'scale': {
        const [sx, sy = sx] = op.values as [number, number];
        opMatrix = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case 'rotate': {
        const [angle, cx, cy] = op.values as [number, number | undefined, number | undefined];
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        if (cx !== undefined && cy !== undefined && cx !== 0 && cy !== 0) {
          const translateMatrix = [1, 0, 0, 1, cx, cy] satisfies TransformationMatrix;
          const rotateMatrix = [cos, sin, -sin, cos, 0, 0] satisfies TransformationMatrix;
          const translateBackMatrix = [1, 0, 0, 1, -cx, -cy] satisfies TransformationMatrix;

          opMatrix = multiply(translateMatrix, multiply(rotateMatrix, translateBackMatrix));
        } else {
          opMatrix = [cos, sin, -sin, cos, 0, 0];
        }
        break;
      }
    }

    this.matrix = multiply(this.matrix, opMatrix);
  }

  /**
   * Converts the transformation to an SVG matrix string.
   *
   * Returns an empty string if the transformation is the identity matrix (no transformation).
   * Otherwise returns a string in the format "matrix(a,b,c,d,e,f)".
   *
   * @returns An SVG-compatible matrix string, or empty string for identity matrix
   *
   * @example
   * ```ts
   * const transform = new SvgTransformBuilder()
   *   .translate(10, 20)
   *   .rotate(45)
   *   .build();
   *
   * const svgString = transform.asSvgString();
   * // Result: "matrix(0.707107,-0.707107,0.707107,0.707107,10,20)"
   * ```
   */
  asSvgString(): string {
    const [a, b, c, d, e, f] = this.matrix;

    if (a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0) {
      return '';
    }

    const formatNumber = (n: number) => {
      const rounded = Math.round(n * 1000000) / 1000000;
      return rounded === Math.floor(rounded) ? rounded.toString() : rounded.toString();
    };

    return `matrix(${formatNumber(a)},${formatNumber(b)},${formatNumber(c)},${formatNumber(d)},${formatNumber(e)},${formatNumber(f)})`;
  }

  /**
   * Applies the transformation to a point.
   *
   * Uses the transformation matrix to calculate the new position of a point
   * after applying all transformations.
   *
   * @param p The point to transform
   * @returns The transformed point
   *
   * @example
   * ```ts
   * const transform = new SvgTransformBuilder()
   *   .translate(10, 20)
   *   .build();
   *
   * const point = { x: 5, y: 5 };
   * const result = transform.transformPoint(point);
   * // Result: { x: 15, y: 25 }
   * ```
   */
  transformPoint(p: Point): Point {
    const [a, b, c, d, e, f] = this.matrix;
    return {
      x: a * p.x + c * p.y + e,
      y: b * p.x + d * p.y + f
    };
  }
}
