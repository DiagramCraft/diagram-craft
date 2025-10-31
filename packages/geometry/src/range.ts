export type Range = [number, number];

/** @namespace */
export const Range = {
  of: (from: number, to: number): Range => {
    return [from, to];
  },

  overlaps: (r1: Range, r2: Range) => {
    return r1[0] <= r2[1] && r2[0] <= r1[1];
  },

  intersection: (r1: Range, r2: Range): Range | undefined => {
    if (!Range.overlaps(r1, r2)) return undefined;

    return Range.of(Math.max(r1[0], r2[0]), Math.min(r1[1], r2[1]));
  },

  midpoint: (r: Range): number => {
    return (r[0] + r[1]) / 2;
  },

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
