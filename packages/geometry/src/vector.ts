/**
 * Vector operations and utilities for 2D vector mathematics.
 *
 * This module provides a comprehensive set of operations for working with 2D vectors,
 * including creation, normalization, transformations, and various geometric calculations
 * such as dot products, cross products, and angles.
 *
 * @example
 * ```ts
 * import { Vector } from '@diagram-craft/geometry/vector';
 *
 * // Create vectors from points
 * const v1 = Vector.from({ x: 0, y: 0 }, { x: 10, y: 10 });
 * const v2 = Vector.fromPolar(Math.PI / 4, 14.14); // 45 degrees, length 14.14
 *
 * // Vector properties
 * const len = Vector.length(v1);        // ~14.14
 * const angle = Vector.angle(v1);       // ~0.785 (45 degrees in radians)
 *
 * // Normalize a vector (make it unit length)
 * const normalized = Vector.normalize(v1); // { x: 0.707, y: 0.707 }
 *
 * // Vector arithmetic
 * const scaled = Vector.scale(v1, 2);   // { x: 20, y: 20 }
 * const negated = Vector.negate(v1);    // { x: -10, y: -10 }
 *
 * // Geometric calculations
 * const dot = Vector.dotProduct(v1, v2);
 * const cross = Vector.crossProduct(v1, v2);
 * const angleBetween = Vector.angleBetween(v1, v2);
 *
 * // Convert tangent to normal
 * const tangent = { x: 1, y: 0 };
 * const normal = Vector.tangentToNormal(tangent); // { x: 0, y: 1 }
 *
 * // Check orientation
 * const horizontal = Vector.isHorizontal({ x: 10, y: 0 }); // true
 * const vertical = Vector.isVertical({ x: 0, y: 10 });     // true
 * ```
 *
 * @module
 */

import type { Point } from './point';
import { isSame } from '@diagram-craft/utils/math';

/**
 * Represents a 2D vector with x and y components.
 *
 * A vector is structurally identical to a Point but represents direction and magnitude
 * rather than a position in space.
 */
export type Vector = Point;

/**
 * Utility functions for working with 2D vectors.
 *
 * @namespace
 */
export const Vector = {
  /**
   * Creates a vector from one point to another.
   *
   * The resulting vector points from c1 to c2.
   *
   * @param c1 The start point
   * @param c2 The end point
   * @returns A vector representing the direction and distance from c1 to c2
   *
   * @example
   * ```ts
   * const v = Vector.from({ x: 0, y: 0 }, { x: 10, y: 20 });
   * // Result: { x: 10, y: 20 }
   * ```
   */
  from: (c1: Point, c2: Point) => {
    return { x: c2.x - c1.x, y: c2.y - c1.y };
  },

  /**
   * Normalizes a vector to unit length.
   *
   * A normalized vector maintains its direction but has a length of 1.
   *
   * @param v The vector to normalize
   * @returns A unit vector in the same direction
   *
   * @example
   * ```ts
   * const v = { x: 3, y: 4 };
   * const normalized = Vector.normalize(v);
   * // Result: { x: 0.6, y: 0.8 } (length is 1)
   * ```
   */
  normalize: (v: Vector) => {
    const l = Vector.length(v);
    return { x: v.x / l, y: v.y / l };
  },

  /**
   * Calculates the 2D cross product (z-component) of two vectors.
   *
   * The cross product in 2D gives a scalar that represents the z-component
   * of the 3D cross product if the vectors were extended to 3D.
   * This is useful for determining the orientation of two vectors.
   *
   * @param v1 The first vector
   * @param v2 The second vector
   * @returns The z-component of the cross product (positive if v2 is counter-clockwise from v1)
   *
   * @example
   * ```ts
   * const v1 = { x: 1, y: 0 };
   * const v2 = { x: 0, y: 1 };
   * const cross = Vector.crossProduct(v1, v2);
   * // Result: 1 (v2 is 90 degrees counter-clockwise from v1)
   * ```
   */
  crossProduct: (v1: Vector, v2: Vector) => {
    return v1.x * v2.y - v1.y * v2.x;
  },

  /**
   * Calculates the angle of a vector in radians.
   *
   * The angle is measured from the positive x-axis, counter-clockwise.
   * Result is in the range [-π, π].
   *
   * @param v The vector
   * @returns The angle in radians
   *
   * @example
   * ```ts
   * const v = { x: 1, y: 1 };
   * const angle = Vector.angle(v);
   * // Result: ~0.785 (π/4, or 45 degrees)
   * ```
   */
  angle: (v: Vector) => {
    return Math.atan2(v.y, v.x);
  },

  /**
   * Calculates the length (magnitude) of a vector.
   *
   * @param v The vector
   * @returns The Euclidean length of the vector
   *
   * @example
   * ```ts
   * const v = { x: 3, y: 4 };
   * const len = Vector.length(v);
   * // Result: 5
   * ```
   */
  length: (v: Vector) => {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },

  /**
   * Creates a vector from polar coordinates.
   *
   * @param angle The angle in radians (measured counter-clockwise from positive x-axis)
   * @param length The length of the vector
   * @returns A vector with the specified angle and length
   *
   * @example
   * ```ts
   * // Create a vector pointing right with length 10
   * const v1 = Vector.fromPolar(0, 10);
   * // Result: { x: 10, y: 0 }
   *
   * // Create a vector pointing up with length 5
   * const v2 = Vector.fromPolar(Math.PI / 2, 5);
   * // Result: { x: 0, y: 5 }
   * ```
   */
  fromPolar: (angle: number, length: number) => {
    return { x: length * Math.cos(angle), y: length * Math.sin(angle) };
  },

  /**
   * Negates a vector (reverses its direction).
   *
   * @param c The vector to negate
   * @returns A vector pointing in the opposite direction with the same length
   *
   * @example
   * ```ts
   * const v = { x: 3, y: 4 };
   * const negated = Vector.negate(v);
   * // Result: { x: -3, y: -4 }
   * ```
   */
  negate: (c: Vector) => ({ x: -c.x, y: -c.y }),

  /**
   * Scales a vector by a scalar factor.
   *
   * @param c The vector to scale
   * @param s The scale factor
   * @returns A vector in the same direction but scaled by s
   *
   * @example
   * ```ts
   * const v = { x: 2, y: 3 };
   * const scaled = Vector.scale(v, 2);
   * // Result: { x: 4, y: 6 }
   * ```
   */
  scale: (c: Vector, s: number) => {
    return { x: c.x * s, y: c.y * s };
  },

  /**
   * Converts a tangent vector to its normal (perpendicular) vector.
   *
   * The resulting normal vector is rotated 90 degrees counter-clockwise from the tangent.
   *
   * @param v The tangent vector
   * @returns The normal vector (perpendicular to v)
   *
   * @example
   * ```ts
   * const tangent = { x: 1, y: 0 };
   * const normal = Vector.tangentToNormal(tangent);
   * // Result: { x: 0, y: 1 }
   * ```
   */
  tangentToNormal(v: Vector) {
    return { x: -v.y, y: v.x };
  },

  /**
   * Calculates the angle between two vectors in radians.
   *
   * The result is always in the range [0, π].
   *
   * @param v1 The first vector
   * @param v2 The second vector
   * @returns The angle between the vectors in radians
   *
   * @example
   * ```ts
   * const v1 = { x: 1, y: 0 };
   * const v2 = { x: 0, y: 1 };
   * const angle = Vector.angleBetween(v1, v2);
   * // Result: ~1.571 (π/2, or 90 degrees)
   * ```
   */
  angleBetween(v1: Vector, v2: Vector) {
    return Math.acos(Vector.dotProduct(v1, v2) / (Vector.length(v1) * Vector.length(v2)));
  },

  /**
   * Calculates the dot product of two vectors.
   *
   * The dot product is useful for determining the angle between vectors
   * and for projecting one vector onto another.
   *
   * @param v1 The first vector
   * @param v2 The second vector
   * @returns The dot product (v1.x * v2.x + v1.y * v2.y)
   *
   * @example
   * ```ts
   * const v1 = { x: 2, y: 3 };
   * const v2 = { x: 4, y: 5 };
   * const dot = Vector.dotProduct(v1, v2);
   * // Result: 23 (2*4 + 3*5)
   * ```
   */
  dotProduct(v1: Vector, v2: Vector) {
    return v1.x * v2.x + v1.y * v2.y;
  },

  /**
   * Checks if a vector is horizontal (y-component is approximately zero).
   *
   * Uses approximate comparison to handle floating-point precision issues.
   *
   * @param v The vector to check
   * @returns True if the vector is horizontal
   *
   * @example
   * ```ts
   * Vector.isHorizontal({ x: 10, y: 0 });      // true
   * Vector.isHorizontal({ x: 10, y: 0.001 });  // true (within tolerance)
   * Vector.isHorizontal({ x: 10, y: 1 });      // false
   * ```
   */
  isHorizontal(v: Vector) {
    return isSame(v.y, 0);
  },

  /**
   * Checks if a vector is vertical (x-component is approximately zero).
   *
   * Uses approximate comparison to handle floating-point precision issues.
   *
   * @param v The vector to check
   * @returns True if the vector is vertical
   *
   * @example
   * ```ts
   * Vector.isVertical({ x: 0, y: 10 });      // true
   * Vector.isVertical({ x: 0.001, y: 10 });  // true (within tolerance)
   * Vector.isVertical({ x: 1, y: 10 });      // false
   * ```
   */
  isVertical(v: Vector) {
    return isSame(v.x, 0);
  }
};

/**
 * Utility functions for working with screen-space vectors.
 *
 * Screen space uses an inverted y-axis (y increases downward) compared to
 * standard mathematical coordinates.
 *
 * @namespace
 */
export const ScreenVector = {
  /**
   * Creates a screen-space vector from polar coordinates.
   *
   * Unlike Vector.fromPolar, this function accounts for the inverted y-axis
   * in screen coordinates where positive y goes down.
   *
   * @param angle The angle in radians (measured counter-clockwise from positive x-axis)
   * @param length The length of the vector
   * @returns A screen-space vector with the specified angle and length
   *
   * @example
   * ```ts
   * // Create a vector pointing down-right in screen space
   * const v = ScreenVector.fromPolar(Math.PI / 4, 10);
   * // Result: { x: ~7.07, y: ~-7.07 } (negative y points down in screen space)
   * ```
   */
  fromPolar: (angle: number, length: number) => {
    return { x: length * Math.cos(angle), y: -length * Math.sin(angle) };
  }
};
