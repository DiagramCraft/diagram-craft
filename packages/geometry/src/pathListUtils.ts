/**
 * Utility functions for transforming path lists.
 *
 * Provides helper functions for applying transformations to paths and path lists,
 * including scaling, rotation, translation, and other geometric transformations.
 *
 * @example
 * ```ts
 * import { transformPathList } from '@diagram-craft/geometry/pathListUtils';
 * import { TransformFactory } from '@diagram-craft/geometry/transform';
 * import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
 *
 * // Create a path list
 * const pathList = new PathListBuilder()
 *   .moveTo({ x: 0, y: 0 })
 *   .lineTo({ x: 100, y: 0 })
 *   .lineTo({ x: 100, y: 100 })
 *   .lineTo({ x: 0, y: 100 })
 *   .close()
 *   .getPaths();
 *
 * // Scale the path list by 2x
 * const scaled = transformPathList(pathList, TransformFactory.scale(2, 2));
 *
 * // Rotate the path list by 45 degrees around a point
 * const rotated = transformPathList(
 *   pathList,
 *   TransformFactory.rotate(45, { x: 50, y: 50 })
 * );
 *
 * // Translate the path list
 * const translated = transformPathList(
 *   pathList,
 *   TransformFactory.translate(100, 50)
 * );
 *
 * // Apply multiple transforms
 * const transformed = transformPathList(pathList, [
 *   ...TransformFactory.scale(2, 2),
 *   ...TransformFactory.rotate(45, { x: 0, y: 0 })
 * ]);
 * ```
 *
 * @module
 */

import { Transform } from './transform';
import { PathList } from './pathList';
import type { Path } from './path';
import { PathListBuilder } from './pathListBuilder';

/**
 * Transforms a single path by applying a list of transformations.
 *
 * @param path The path to transform
 * @param transformList Array of transforms to apply
 * @returns The transformed path
 */
const transformPath = (path: Path, transformList: Transform[]) => {
  return PathListBuilder.fromSegments(path.start, path.raw)
    .withTransform(transformList)
    .getPaths()
    .singular();
};

/**
 * Transforms all paths in a PathList by applying a list of transformations.
 *
 * This function applies the specified transformations to each path in the list,
 * creating a new PathList with the transformed paths.
 *
 * @param pathList The path list to transform
 * @param transformList Array of transforms to apply to each path
 * @returns A new PathList with all paths transformed
 *
 * @example
 * ```ts
 * // Scale a path list
 * const scaled = transformPathList(paths, TransformFactory.scale(2, 2));
 *
 * // Rotate around a point
 * const rotated = transformPathList(
 *   paths,
 *   TransformFactory.rotate(45, { x: 50, y: 50 })
 * );
 * ```
 */
export const transformPathList = (pathList: PathList, transformList: Transform[]) => {
  return new PathList(pathList.all().map(p => transformPath(p, transformList)));
};
