/**
 * Polygon operations including intersection and containment testing.
 *
 * This module provides utilities for working with polygons defined as sequences of points.
 * It implements the Separating Axis Theorem (SAT) for intersection detection and
 * cross-product based containment testing.
 *
 * @example
 * ```ts
 * import { Polygon } from '@diagram-craft/geometry/polygon';
 *
 * // Create a square polygon
 * const square: Polygon = {
 *   points: [
 *     { x: 0, y: 0 },
 *     { x: 100, y: 0 },
 *     { x: 100, y: 100 },
 *     { x: 0, y: 100 }
 *   ]
 * };
 *
 * // Create a triangle
 * const triangle: Polygon = {
 *   points: [
 *     { x: 50, y: 50 },
 *     { x: 150, y: 50 },
 *     { x: 100, y: 150 }
 *   ]
 * };
 *
 * // Check if polygons intersect
 * if (Polygon.intersects(square, triangle)) {
 *   console.log('Polygons intersect or overlap');
 * }
 *
 * // Check if a point is inside a polygon
 * const testPoint = { x: 50, y: 50 };
 * if (Polygon.contains(square, testPoint)) {
 *   console.log('Point is inside the polygon');
 * }
 * ```
 *
 * @module
 */

import { Point } from './point';
import { Vector } from './vector';

/**
 * Represents a polygon as a sequence of connected points.
 *
 * The points are assumed to be in order (either clockwise or counter-clockwise)
 * and the polygon is implicitly closed (the last point connects back to the first).
 */
export type Polygon = {
  /** The vertices of the polygon in order */
  points: ReadonlyArray<Point>;
};

/**
 * Utility functions for working with polygons.
 *
 * @namespace
 */
export const Polygon = {
  /**
   * Checks if two polygons intersect or overlap using the Separating Axis Theorem (SAT).
   *
   * The SAT algorithm works by projecting both polygons onto various axes and checking
   * if the projections overlap. If there exists an axis where the projections don't
   * overlap, the polygons don't intersect. If all projections overlap, the polygons
   * do intersect.
   *
   * This function tests axes perpendicular to each edge of both polygons.
   *
   * @param a The first polygon
   * @param b The second polygon
   * @returns True if the polygons intersect or overlap, false otherwise
   *
   * @example
   * ```ts
   * const rect1 = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
   * const rect2 = { points: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }] };
   * const overlaps = Polygon.intersects(rect1, rect2); // true
   * ```
   */
  intersects(a: Polygon, b: Polygon) {
    for (const polygon of [a, b]) {
      for (let i = 0; i < polygon.points.length; i++) {
        const j = (i + 1) % polygon.points.length;

        const start = polygon.points[i]!;
        const end = polygon.points[j]!;

        const normal = { y: end.y - start.y, x: start.x - end.x };

        let minA = Number.MAX_SAFE_INTEGER;
        let maxA = Number.MIN_SAFE_INTEGER;
        let minB = Number.MAX_SAFE_INTEGER;
        let maxB = Number.MIN_SAFE_INTEGER;

        for (const p of a.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (projected < minA) minA = projected;
          if (projected > maxA) maxA = projected;
        }

        for (const p of b.points) {
          const projected = normal.x * p.x + normal.y * p.y;
          if (projected < minB) minB = projected;
          if (projected > maxB) maxB = projected;
        }

        if (maxA < minB || maxB < minA) return false;
      }
    }
    return true;
  },

  /**
   * Checks if a point is inside or on the boundary of a polygon.
   *
   * This function uses the cross-product method to determine containment. For each edge
   * of the polygon, it calculates the cross product of the edge vector and the vector
   * from the edge start to the test point. If all cross products have the same sign
   * (all positive or all negative), the point is inside the polygon.
   *
   * The function also returns true if the test point exactly matches any vertex.
   *
   * @param polygon The polygon to test
   * @param testPoint The point to check
   * @returns True if the point is inside or on the polygon boundary, false otherwise
   *
   * @example
   * ```ts
   * const triangle = {
   *   points: [
   *     { x: 0, y: 0 },
   *     { x: 100, y: 0 },
   *     { x: 50, y: 100 }
   *   ]
   * };
   *
   * Polygon.contains(triangle, { x: 50, y: 40 }); // true (inside)
   * Polygon.contains(triangle, { x: 0, y: 0 });   // true (on vertex)
   * Polygon.contains(triangle, { x: 150, y: 50 }); // false (outside)
   * ```
   */
  contains: (polygon: Polygon, testPoint: Point) => {
    const crossProducts: number[] = [];

    for (let i = 0; i < polygon.points.length; i++) {
      if (Point.isEqual(polygon.points[i]!, testPoint)) return true;

      const start = polygon.points[i]!;
      const end = polygon.points[(i + 1) % polygon.points.length]!;

      crossProducts.push(
        Vector.crossProduct(Vector.from(start, end), Vector.from(testPoint, start))
      );
    }

    return crossProducts.every(d => d >= 0) || crossProducts.every(d => d <= 0);
  }
};
