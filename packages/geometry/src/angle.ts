/**
 * Angle conversion and orientation utilities.
 *
 * @example
 * ```ts
 * import { Angle } from '@diagram-craft/geometry/angle';
 *
 * // Convert between radians and degrees
 * const deg = Angle.toDeg(Math.PI); // 180
 * const rad = Angle.toRad(90); // π/2
 *
 * // Check orientation
 * if (Angle.isVertical(rotation)) {
 *   // Handle vertical edge
 * }
 *
 * // Normalize angles to 0-2π range
 * const normalized = Angle.normalize(-Math.PI / 4); // 7π/4
 * ```
 *
 * @module
 */

import { round } from '@diagram-craft/utils/math';

/**
 * Namespace containing angle conversion and utility functions.
 *
 * @namespace
 */
export const Angle = {
  /**
   * Converts radians to degrees.
   *
   * @param radians - The angle in radians
   * @returns The angle in degrees (0-360)
   */
  toDeg: (radians: number) => (radians * (180 / Math.PI)) % 360,

  /**
   * Converts degrees to radians.
   *
   * @param degrees - The angle in degrees
   * @returns The angle in radians
   */
  toRad: (degrees: number) => degrees * (Math.PI / 180),

  /**
   * Checks if an angle is vertical (90° or 270°).
   *
   * @param angle - The angle in radians
   * @returns True if the angle is vertical
   */
  isVertical: (angle: number) => {
    return round(angle) === round(Math.PI / 2) || round(angle) === round((3 * Math.PI) / 2);
  },

  /**
   * Checks if an angle is horizontal (0° or 180°).
   *
   * @param angle - The angle in radians
   * @returns True if the angle is horizontal
   */
  isHorizontal: (angle: number) => {
    return round(angle) === 0 || round(angle) === round(Math.PI);
  },

  /**
   * Checks if an angle is a cardinal direction (0°, 90°, 180°, or 270°).
   *
   * @param angle - The angle in radians
   * @returns True if the angle is cardinal
   */
  isCardinal: (angle: number) => {
    const cardinalDirections = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    return cardinalDirections.some(cardinal => round(angle) === round(cardinal));
  },

  /**
   * Normalizes an angle to the range [0, 2π).
   *
   * @param radians - The angle in radians
   * @returns The normalized angle in radians
   */
  normalize: (radians: number) => {
    let a = radians;
    while (a < 0) {
      a += Math.PI * 2;
    }
    return a % (Math.PI * 2);
  }
};
