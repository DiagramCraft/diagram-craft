/**
 * Utility functions for analyzing path hierarchies and containment relationships.
 *
 * This module provides tools for determining which paths contain other paths,
 * building hierarchical trees of nested shapes, and classifying paths as outlines or holes.
 *
 * @example
 * ```ts
 * import { constructPathTree } from '@diagram-craft/geometry/pathUtils';
 * import { Path } from '@diagram-craft/geometry/path';
 *
 * // Create a rectangle with a hole
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
 * // Construct the hierarchy tree
 * const tree = constructPathTree([outline, hole]);
 *
 * // Check the hierarchy
 * const outlineHierarchy = tree.get(outline);
 * // Result: { depth: 0, type: 'outline', parent: undefined }
 *
 * const holeHierarchy = tree.get(hole);
 * // Result: { depth: 1, type: 'hole', parent: outline }
 * ```
 *
 * @module
 */

import type { Path } from './path';
import { MultiMap } from '@diagram-craft/utils/multimap';

/**
 * Type indicating whether a path is an outline or a hole.
 */
type Type = 'outline' | 'hole';

/**
 * Represents the hierarchical position of a path in a tree of nested shapes.
 *
 * Paths at depth 0 are top-level outlines. Paths at depth 1 are holes within
 * those outlines. Paths at depth 2 are outlines within holes, and so on.
 */
export type Hierarchy = {
  /** The nesting depth of the path (0 = top-level) */
  depth: number;
  /** Whether this path is an outline or a hole */
  type: Type;
  /** The parent path that contains this path, or undefined if at depth 0 */
  parent: Path | undefined;
};

/**
 * Checks if two arrays of path indices are identical.
 *
 * @param existing The first array of path indices
 * @param path The second array of path indices
 * @returns True if both arrays have the same elements in the same order
 */
const hasSamePath = (existing: number[], path: number[]) => {
  if (existing.length !== path.length) return false;
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] !== path[i]) return false;
  }
  return true;
};

/**
 * Constructs a hierarchical tree of paths based on containment relationships.
 *
 * This function analyzes a collection of paths to determine which paths contain
 * other paths, building a tree structure that represents the nesting hierarchy.
 * Paths are classified as either outlines (positive space) or holes (negative space)
 * based on their nesting level.
 *
 * The algorithm:
 * 1. For each path, determines which other paths contain it
 * 2. Builds a tree where children are paths directly contained by their parent
 * 3. Alternates between 'outline' and 'hole' types at each depth level
 *
 * @param paths Array of paths to analyze
 * @param epsilon Tolerance for point-on-path detection (default: 0.1)
 * @returns A map from each path to its hierarchy information
 *
 * @example
 * ```ts
 * // Two nested rectangles
 * const outer = new Path({ x: 0, y: 0 }, [...]);
 * const inner = new Path({ x: 10, y: 10 }, [...]);
 *
 * const tree = constructPathTree([outer, inner]);
 *
 * tree.get(outer).depth; // 0
 * tree.get(outer).type;  // 'outline'
 * tree.get(inner).depth; // 1
 * tree.get(inner).type;  // 'hole'
 * tree.get(inner).parent; // outer
 * ```
 */
export const constructPathTree = (paths: Path[], epsilon = 0.1) => {
  const childToParents = new MultiMap<number, number>();
  for (let child = 0; child < paths.length; child++) {
    for (let parent = 0; parent < paths.length; parent++) {
      if (child === parent) continue;

      if (
        paths[child]!.segments.map(s => s.start).every(
          p => paths[parent]!.isInside(p) || paths[parent]!.isOn(p, epsilon)
        )
      ) {
        childToParents.add(child, parent);
      }
    }
  }

  const dest = new Map<Path, Hierarchy>();

  const classifyChildren = (path: number[], depth: number, type: Type) => {
    const parent = path.length === 0 ? undefined : paths[path.at(-1)!];
    const sortedPath = path.toSorted();

    const children: number[] = [];
    for (let childIdx = 0; childIdx < paths.length; childIdx++) {
      const sortedParents = childToParents.get(childIdx).toSorted();

      if (hasSamePath(sortedParents, sortedPath)) {
        dest.set(paths[childIdx]!, { depth, type, parent });
        children.push(childIdx);
      }
    }

    for (const c of children) {
      classifyChildren([...path, c], depth + 1, type === 'outline' ? 'hole' : 'outline');
    }
  };

  classifyChildren([], 0, 'outline');

  return dest;
};
