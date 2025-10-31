/**
 * Extent (width and height) type and utilities.
 *
 * @example
 * ```ts
 * import { Extent } from '@diagram-craft/geometry/extent';
 *
 * // Create an extent
 * const nodeSize = Extent.of(200, 150);
 *
 * // Check if two sizes are equal
 * if (Extent.isEqual(originalSize, newSize)) {
 *   console.log('Node size unchanged');
 * }
 * ```
 *
 * @module
 */

/**
 * Represents a size or dimension with width and height.
 */
export type Extent = Readonly<{
  w: number;
  h: number;
}>;

/**
 * Utility functions for working with Extent objects.
 *
 * @namespace
 */
export const Extent = {
  /**
   * Creates an Extent from width and height values.
   *
   * @param w - Width
   * @param h - Height
   * @returns An Extent object
   */
  of: (w: number, h: number): Extent => ({ w, h }),

  /**
   * Checks if two Extents are equal.
   *
   * @param a - First extent
   * @param b - Second extent
   * @returns True if both width and height are equal
   */
  isEqual: (a: Extent, b: Extent) => a.w === b.w && a.h === b.h
};
