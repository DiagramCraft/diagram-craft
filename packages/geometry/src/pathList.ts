/**
 * Collection of paths with operations for working with complex shapes including holes and nested regions.
 *
 * PathList represents a set of paths that together form a complete shape. It supports operations
 * like normalization (ensuring correct winding order), point containment testing, and projection.
 *
 * @example
 * ```ts
 * import { PathList } from '@diagram-craft/geometry/pathList';
 * import { Path } from '@diagram-craft/geometry/path';
 *
 * // Create a shape with a hole
 * const outline = new Path({ x: 0, y: 0 }, [
 *   ['L', 100, 0],
 *   ['L', 100, 100],
 *   ['L', 0, 100],
 *   ['L', 0, 0]
 * ]);
 *
 * const hole = new Path({ x: 25, y: 25 }, [
 *   ['L', 75, 25],
 *   ['L', 75, 75],
 *   ['L', 25, 75],
 *   ['L', 25, 25]
 * ]);
 *
 * const pathList = new PathList([outline, hole]).normalize();
 *
 * // Test if a point is inside the shape (but not in the hole)
 * if (pathList.isInside({ x: 10, y: 10 })) {
 *   console.log('Point is inside the shape');
 * }
 *
 * // Project a point onto the nearest path
 * const projected = pathList.projectPoint(mousePosition);
 *
 * // Get the bounding box of all paths
 * const bounds = pathList.bounds();
 * ```
 *
 * @module
 */

import { Path } from './path';
import { assert } from '@diagram-craft/utils/assert';
import { Box } from './box';
import { Point } from './point';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';
import { constructPathTree, type Hierarchy } from './pathUtils';

/**
 * Represents the result of projecting a point onto a path list.
 */
type ProjectedPointOnPathList = {
  offset: TimeOffsetOnSegment & LengthOffsetOnPath;
  point: Point;
  pathIdx: number;
};

const FAR_DISTANCE = 1000000;

const RAY_OFFSETS: [number, number][] = [
  [17, 25],
  [-13, 19],
  [-7, -11],
  [11, -17]
];

/**
 * Represents a collection of paths that form a complete shape with optional holes.
 *
 * PathList manages multiple paths where outlines and holes are distinguished by winding order.
 * Counter-clockwise paths are outlines, clockwise paths are holes.
 */
export class PathList {
  constructor(private paths: Path[]) {}

  /**
   * Returns the single path in this list.
   *
   * Asserts that the list contains exactly one path.
   *
   * @returns The single path
   * @throws If the list doesn't contain exactly one path
   */
  singular() {
    assert.arrayWithExactlyOneElement(
      this.paths,
      `Expected a single path, ${this.paths.length} found`
    );
    return this.paths[0];
  }

  /**
   * Gets all paths in this list.
   *
   * @returns Array of all paths
   */
  all() {
    return this.paths;
  }

  /**
   * Calculates the bounding box containing all paths.
   *
   * @returns A box that contains all paths in the list
   */
  bounds() {
    return Box.boundingBox(this.paths.map(p => p.bounds()));
  }

  /**
   * Converts all paths to a single SVG path string.
   *
   * @returns SVG path string representation of all paths
   */
  asSvgPath() {
    return this.paths.map(p => p.asSvgPath()).join(' ');
  }

  /**
   * Gets all segments from all paths.
   *
   * @returns Flattened array of all path segments
   */
  segments() {
    return this.paths.flatMap(p => p.segments);
  }

  /**
   * Normalizes the path list by ensuring correct winding order.
   *
   * This method organizes paths into a hierarchy and ensures that outlines are
   * counter-clockwise and holes are clockwise. This is essential for proper
   * rendering and boolean operations.
   *
   * @returns This path list (for chaining)
   */
  normalize() {
    // TODO: First we remove all self-intersections

    const classification = constructPathTree(this.paths, 1);

    const dest: Path[] = [];

    for (let depth = 0; depth < this.paths.length; depth++) {
      let found = false;

      for (const p of this.paths) {
        const c = classification.get(p);
        if (c && c.depth === depth) {
          const state = c?.type === 'outline';

          if (p.isClockwise() && state) dest.push(p.reverse());
          else if (!p.isClockwise() && !state) dest.push(p.reverse());
          else {
            dest.push(p);
          }

          found = true;
        }
      }

      if (!found) break;
    }

    this.paths = dest;

    return this;
  }

  /**
   * Creates a deep copy of this path list.
   *
   * @returns A new path list with cloned paths
   */
  clone() {
    return new PathList(this.paths.map(path => path.clone()));
  }

  /**
   * Projects a point onto the nearest path in the list.
   *
   * Finds the closest point on any path in the list to the given point.
   *
   * @param p The point to project
   * @returns The projected point with path index and offset information
   */
  projectPoint(p: Point): ProjectedPointOnPathList {
    let best: ProjectedPointOnPathList | undefined;
    for (let idx = 0; idx < this.paths.length; idx++) {
      const path = this.paths[idx]!;

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

  /**
   * Checks if a point is inside the shape defined by the path list.
   *
   * Uses the ray casting algorithm with multiple ray directions to handle edge cases.
   * Takes holes into account - points inside holes are considered outside.
   *
   * @param p The point to test
   * @returns True if the point is inside the shape, false otherwise
   */
  isInside(p: Point): boolean {
    for (const [dx, dy] of RAY_OFFSETS) {
      const line = new Path(p, [['L', dx * FAR_DISTANCE, dy * FAR_DISTANCE]]);
      const intersections = this.all().flatMap(p => p.intersections(line));
      if (intersections.length % 2 === 0) return false;
    }
    return true;
  }

  /**
   * Checks if a point lies on any path in the list.
   *
   * @param p The point to check
   * @param epsilon The tolerance for the check (default: 0.0001)
   * @returns True if the point is on any path, false otherwise
   */
  isOn(p: Point, epsilon = 0.0001): boolean {
    return this.paths.some(path => path.isOn(p, epsilon));
  }

  /**
   * Finds all intersection points between the paths in this list and another path.
   *
   * @param p The path to check for intersections
   * @returns Array of intersection points
   */
  intersections(p: Path): Point[] {
    return this.paths.flatMap(path => path.intersections(p)).map(i => i.point);
  }
}

/**
 * Splits a path list into separate disjoint path lists.
 *
 * This function takes a path list that may contain multiple disconnected shapes
 * and separates them into individual path lists. Each resulting path list contains
 * a single connected shape with its associated holes.
 *
 * @param pathList The path list to split
 * @returns Array of disjoint path lists
 */
export const splitDisjointsPathList = (pathList: PathList): Array<PathList> => {
  const makePathList = (parent: Path, classification: Map<Path, Hierarchy>, dest: Path[]) => {
    dest.push(parent);
    for (const [path, hierarchy] of classification.entries()) {
      if (hierarchy.parent !== parent) continue;
      makePathList(path, classification, dest);
    }
  };

  const dest: PathList[] = [];

  const p = pathList.normalize();

  const classification = constructPathTree(p.all(), 1);

  for (const [path, hierarchy] of classification.entries()) {
    if (hierarchy.depth > 0) continue;

    const destPathList: Path[] = [];
    makePathList(path, classification, destPathList);
    dest.push(new PathList(destPathList).normalize().clone());
  }

  return dest;
};
