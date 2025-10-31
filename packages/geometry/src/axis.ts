/**
 * Axis type and utilities for horizontal/vertical operations.
 *
 * @example
 * ```ts
 * import { Axis } from '@diagram-craft/geometry/axis';
 *
 * // Get orthogonal axis
 * const perpendicular = Axis.orthogonal(Axis.h); // 'v'
 *
 * // Convert axis to coordinate name
 * const coord = Axis.toXY(Axis.h); // 'x'
 *
 * // Iterate over both axes
 * for (const axis of Axis.axes()) {
 *   console.log(axis); // 'h', then 'v'
 * }
 * ```
 *
 * @module
 */

/**
 * Represents a geometric axis - either horizontal ('h') or vertical ('v').
 */
export type Axis = 'h' | 'v';

/**
 * Namespace containing axis constants and utility functions.
 *
 * @namespace
 */
export const Axis = {
  /** Horizontal axis constant */
  h: 'h' as Axis,

  /** Vertical axis constant */
  v: 'v' as Axis,

  /**
   * Returns an array of all axes.
   *
   * @returns Array containing both horizontal and vertical axes
   */
  axes: (): ReadonlyArray<Axis> => ['h', 'v'],

  /**
   * Returns the orthogonal (perpendicular) axis.
   *
   * @param axis - The input axis
   * @returns The perpendicular axis ('h' returns 'v', 'v' returns 'h')
   */
  orthogonal: (axis: Axis): Axis => (axis === 'h' ? 'v' : 'h'),

  /**
   * Converts an axis to its corresponding coordinate name.
   *
   * @param axis - The input axis
   * @returns 'x' for horizontal, 'y' for vertical
   */
  toXY: (axis: Axis): 'x' | 'y' => (axis === 'h' ? 'x' : 'y')
};
