/**
 * Point operations and utilities for 2D coordinate manipulation.
 *
 * This module provides the Point type and a comprehensive set of operations for working
 * with 2D points, including arithmetic, transformations, distance calculations, and comparisons.
 *
 * @example
 * ```ts
 * import { Point } from '@diagram-craft/geometry/point';
 *
 * // Create points
 * const p1 = Point.of(10, 20);
 * const p2 = Point.of(30, 40);
 * const origin = Point.ORIGIN; // { x: 0, y: 0 }
 *
 * // Point arithmetic
 * const sum = Point.add(p1, { x: 5, y: 10 });      // { x: 15, y: 30 }
 * const diff = Point.subtract(p1, { x: 5, y: 10 }); // { x: 5, y: 10 }
 *
 * // Calculate midpoint
 * const mid = Point.midpoint(p1, p2); // { x: 20, y: 30 }
 *
 * // Distance calculations
 * const dist = Point.distance(p1, p2);         // ~28.28
 * const manhattan = Point.manhattanDistance(p1, p2); // 40
 *
 * // Rotations
 * const rotated = Point.rotate(p1, Math.PI / 2); // Rotate 90 degrees around origin
 * const rotatedAround = Point.rotateAround(p1, Math.PI / 4, { x: 0, y: 0 });
 *
 * // Comparisons
 * if (Point.isEqual(p1, p2, 0.1)) {
 *   console.log('Points are approximately equal');
 * }
 *
 * // From tuple
 * const fromTuple = Point.ofTuple([15, 25]); // { x: 15, y: 25 }
 * ```
 *
 * @module
 */

import { Vector } from './vector';
import { isSame, round } from '@diagram-craft/utils/math';

/**
 * Represents a 2D point with x and y coordinates.
 *
 * Points are immutable (readonly) to prevent accidental modification.
 */
export type Point = Readonly<{
  x: number;
  y: number;
}>;

/**
 * Type alias for Point when used to represent scale factors.
 */
export type Scale = Point;

/**
 * Type alias for Point when used to represent relative offsets.
 */
export type RelativeOffset = Point;

/**
 * Type alias for Point when used to represent absolute offsets.
 */
export type AbsoluteOffset = Point;

/**
 * Utility functions for working with 2D points.
 *
 * @namespace
 */
export const Point = {
  /** The origin point (0, 0) */
  ORIGIN: { x: 0, y: 0 },

  /**
   * Creates a point from x and y coordinates.
   *
   * @param x The x coordinate
   * @param y The y coordinate
   * @returns A new point
   */
  of: (x: number, y: number) => ({ x, y }),

  /**
   * Creates a point from a tuple of coordinates.
   *
   * @param p A tuple [x, y]
   * @returns A new point
   */
  ofTuple: (p: [number, number] | readonly [number, number]) => ({ x: p[0], y: p[1] }),

  /**
   * Adds a vector to a point.
   *
   * @param c1 The point
   * @param c2 The vector to add
   * @returns A new point offset by the vector
   */
  add: (c1: Point, c2: Vector) => ({ x: c1.x + c2.x, y: c1.y + c2.y }),

  /**
   * Subtracts a vector from a point.
   *
   * @param c1 The point
   * @param c2 The vector to subtract
   * @returns A new point offset by the negative vector
   */
  subtract: (c1: Point, c2: Vector) => ({ x: c1.x - c2.x, y: c1.y - c2.y }),

  /**
   * Calculates the midpoint between two points.
   *
   * @param c1 The first point
   * @param c2 The second point
   * @returns The point exactly halfway between c1 and c2
   */
  midpoint: (c1: Point, c2: Point) => ({ x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }),

  /**
   * Rotates a point around the origin.
   *
   * @param c The point to rotate
   * @param r The rotation angle in radians
   * @returns The rotated point
   */
  rotate: (c: Point, r: number) => {
    return {
      x: c.x * Math.cos(r) - c.y * Math.sin(r),
      y: c.x * Math.sin(r) + c.y * Math.cos(r)
    };
  },

  /**
   * Rotates a point around a specified center of rotation.
   *
   * If the rotation angle is zero, returns the original point unchanged.
   *
   * @param c The point to rotate
   * @param r The rotation angle in radians
   * @param centerOfRotation The point to rotate around
   * @returns The rotated point
   */
  rotateAround: (c: Point, r: number, centerOfRotation: Point) => {
    if (round(r) === 0) return c;
    const newCoord = Point.subtract(c, centerOfRotation);
    const rotatedCoord = Point.rotate(newCoord, r);
    return Point.add(rotatedCoord, centerOfRotation);
  },

  /**
   * Checks if two points are equal within a tolerance.
   *
   * Uses approximate comparison to handle floating-point precision issues.
   *
   * @param a The first point
   * @param b The second point
   * @param epsilon The tolerance for comparison (default: 0.01)
   * @returns True if the points are approximately equal
   */
  isEqual: (a: Point, b: Point, epsilon = 0.01) => {
    return isSame(a.x, b.x, epsilon) && isSame(a.y, b.y, epsilon);
  },

  /**
   * Calculates the squared Euclidean distance between two points.
   *
   * This is more efficient than distance() when you only need to compare distances,
   * as it avoids the square root calculation.
   *
   * @param posA The first point
   * @param posB The second point
   * @returns The squared distance
   */
  squareDistance(posA: Point, posB: Point) {
    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    return dx * dx + dy * dy;
  },

  /**
   * Calculates the Manhattan distance (taxicab distance) between two points.
   *
   * The Manhattan distance is the sum of the absolute differences of the coordinates.
   * It represents the distance if you can only move horizontally or vertically.
   *
   * @param posA The first point
   * @param posB The second point
   * @returns The Manhattan distance
   */
  manhattanDistance: (posA: Point, posB: Point) => {
    return Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
  },

  /**
   * Calculates the Euclidean distance between two points.
   *
   * This is the straight-line distance between the two points.
   *
   * @param posA The first point
   * @param posB The second point
   * @returns The Euclidean distance
   */
  distance: (posA: Point, posB: Point) => {
    return Math.sqrt(Point.squareDistance(posA, posB));
  },

  /**
   * Converts a point to a string representation.
   *
   * Coordinates are rounded to 4 decimal places for readability.
   *
   * @param p The point
   * @returns A string in the format "(x, y)"
   */
  toString: (p: Point) => `(${round(p.x, 4)}, ${round(p.y, 4)})`
};

/**
 * Shorthand alias for Point.of.
 *
 * Provides a more concise way to create points in code.
 *
 * @example
 * ```ts
 * const p = _p(10, 20); // Same as Point.of(10, 20)
 * ```
 */
export const _p = Point.of;
