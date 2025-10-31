/**
 * Range operations and utilities for working with 1D intervals.
 *
 * This module provides utilities for working with ranges (intervals) represented as tuples of two numbers.
 * Ranges can be used for many purposes like coordinate ranges, time intervals, or any bounded numeric values.
 *
 * @example
 * ```ts
 * import { Range } from '@diagram-craft/geometry/range';
 *
 * // Create ranges
 * const r1 = Range.of(0, 100);    // [0, 100]
 * const r2 = Range.of(50, 150);   // [50, 150]
 *
 * // Check if ranges overlap
 * if (Range.overlaps(r1, r2)) {
 *   console.log('Ranges overlap'); // true
 * }
 *
 * // Find intersection
 * const intersection = Range.intersection(r1, r2); // [50, 100]
 *
 * // Calculate properties
 * const mid = Range.midpoint(r1);  // 50
 * const len = Range.length(r1);    // 100
 *
 * // Transform ranges
 * const shifted = Range.add(r1, 10);     // [10, 110]
 * const scaled = Range.scale(r1, 2);      // [-50, 150]
 *
 * // Test containment
 * Range.contains(r1, 50);  // true
 * Range.contains(r1, 150); // false
 *
 * // Clamp values
 * const clamped = Range.clamp(r1, 150); // 100
 *
 * // Normalize invalid ranges
 * const invalid = Range.of(100, 0);
 * const valid = Range.normalize(invalid); // [0, 100]
 * ```
 *
 * @module
 */

/**
 * Represents a 1D range (interval) as a tuple of two numbers [start, end].
 *
 * By convention, the first element should be less than or equal to the second,
 * though some functions handle non-normalized ranges gracefully.
 */
export type Range = [number, number];

/**
 * Utility functions for working with ranges.
 *
 * @namespace
 */
export const Range = {
  /**
   * Creates a range from start and end values.
   *
   * @param from The start of the range
   * @param to The end of the range
   * @returns A new range tuple
   */
  of: (from: number, to: number): Range => {
    return [from, to];
  },

  /**
   * Checks if two ranges overlap (have any common values).
   *
   * Ranges are considered overlapping if they share at least one point,
   * including at their endpoints.
   *
   * @param r1 The first range
   * @param r2 The second range
   * @returns True if the ranges overlap, false otherwise
   *
   * @example
   * ```ts
   * Range.overlaps([0, 10], [5, 15]);  // true (overlap)
   * Range.overlaps([0, 10], [10, 20]); // true (touch at 10)
   * Range.overlaps([0, 10], [11, 20]); // false (no overlap)
   * ```
   */
  overlaps: (r1: Range, r2: Range) => {
    return r1[0] <= r2[1] && r2[0] <= r1[1];
  },

  /**
   * Finds the intersection of two ranges.
   *
   * Returns the overlapping portion of both ranges, or undefined if they don't overlap.
   *
   * @param r1 The first range
   * @param r2 The second range
   * @returns The intersection range, or undefined if no overlap exists
   *
   * @example
   * ```ts
   * Range.intersection([0, 10], [5, 15]);  // [5, 10]
   * Range.intersection([0, 10], [10, 20]); // [10, 10]
   * Range.intersection([0, 10], [11, 20]); // undefined
   * ```
   */
  intersection: (r1: Range, r2: Range): Range | undefined => {
    if (!Range.overlaps(r1, r2)) return undefined;

    return Range.of(Math.max(r1[0], r2[0]), Math.min(r1[1], r2[1]));
  },

  /**
   * Calculates the midpoint of a range.
   *
   * @param r The range
   * @returns The value exactly in the middle of the range
   */
  midpoint: (r: Range): number => {
    return (r[0] + r[1]) / 2;
  },

  /**
   * Shifts a range by adding a constant value to both endpoints.
   *
   * @param r The range to shift
   * @param d The amount to add to both endpoints
   * @returns A new range shifted by d
   *
   * @example
   * ```ts
   * Range.add([0, 10], 5);  // [5, 15]
   * Range.add([0, 10], -5); // [-5, 5]
   * ```
   */
  add: (r: Range, d: number): Range => {
    return [r[0] + d, r[1] + d];
  },

  /**
   * Checks if a range contains a specific value.
   * @param r The range to check
   * @param value The value to check
   * @returns True if the value is within the range (inclusive), false otherwise
   */
  contains: (r: Range, value: number): boolean => {
    return value >= r[0] && value <= r[1];
  },

  /**
   * Calculates the length of a range.
   * @param r The range
   * @returns The length of the range (always non-negative)
   */
  length: (r: Range): number => {
    return Math.abs(r[1] - r[0]);
  },

  /**
   * Checks if a range is valid (start <= end).
   * @param r The range to check
   * @returns True if the range is valid, false otherwise
   */
  isValid: (r: Range): boolean => {
    return r[0] <= r[1];
  },

  /**
   * Ensures a range is valid by swapping start and end if necessary.
   * @param r The range to normalize
   * @returns A new range with start <= end
   */
  normalize: (r: Range): Range => {
    return r[0] <= r[1] ? r : Range.of(r[1], r[0]);
  },

  /**
   * Scales a range by a factor around its midpoint.
   * @param r The range to scale
   * @param factor The scaling factor
   * @returns A new scaled range
   */
  scale: (r: Range, factor: number): Range => {
    const mid = Range.midpoint(r);
    const halfLength = (r[1] - r[0]) / 2;
    const newHalfLength = halfLength * factor;
    return Range.of(mid - newHalfLength, mid + newHalfLength);
  },

  /**
   * Clamps a value to be within a range.
   * @param r The range
   * @param value The value to clamp
   * @returns The clamped value
   */
  clamp: (r: Range, value: number): number => {
    // Normalize the range to ensure start <= end
    const normalizedRange = Range.normalize(r);
    return Math.min(Math.max(value, normalizedRange[0]), normalizedRange[1]);
  }
};
