/**
 * Mathematical utility functions.
 *
 * @example
 * ```ts
 * import { round, clamp, isSame } from '@diagram-craft/utils/math';
 *
 * const value = round(3.14159, 2); // 3.14
 * const limited = clamp(15, 0, 10); // 10
 * const equal = isSame(0.1 + 0.2, 0.3); // true
 * ```
 *
 * @module
 */

/**
 * Rounds a number to a specified number of decimal places.
 *
 * Ensures -0 is normalized to 0.
 *
 * @param n - The number to round
 * @param precision - Number of decimal places (default: 2)
 * @returns The rounded number
 *
 * @example
 * ```ts
 * round(3.14159); // 3.14
 * round(3.14159, 3); // 3.142
 * ```
 */
export const round = (n: number, precision = 2) => {
  const p = 10 ** precision;
  const res = Math.round(n * p) / p;
  // To ensure -0 === 0
  if (res === 0) return 0;
  return res;
};

/**
 * Returns a number whose value is limited to the given range.
 *
 * @param n - The number to be clamped.
 * @param min - The lower limit of the range.
 * @param max - The upper limit of the range.
 * @returns The clamped number.
 *
 * @example
 * // returns 10
 * clamp(10, 5, 15);
 *
 * @example
 * // returns 5
 * clamp(3, 5, 15);
 *
 * @example
 * // returns 15
 * clamp(20, 5, 15);
 */
export const clamp = (n: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, n));
};

/**
 * Checks if two numbers are approximately equal within a certain tolerance.
 *
 * @param a - The first number to compare.
 * @param b - The second number to compare.
 * @param [epsilon=0.01] - The tolerance for the comparison. Defaults to 0.01.
 * @returns True if the absolute difference between the two numbers is less than the tolerance, false otherwise.
 *
 * @example
 * // returns true
 * isSame(10, 10.005);
 *
 * @example
 * // returns false
 * isSame(10, 10.02);
 */
export const isSame = (a: number, b: number, epsilon = 0.01) => {
  return Math.abs(a - b) < epsilon;
};

/**
 * Checks if two numbers are not approximately equal within a certain tolerance.
 *
 * @param a - The first number to compare.
 * @param b - The second number to compare.
 * @param [epsilon=0.01] - The tolerance for the comparison. Defaults to 0.01.
 * @returns True if the absolute difference between the two numbers is greater than or equal to the tolerance, false otherwise.
 *
 * @example
 * // returns false
 * isDifferent(10, 10.005);
 *
 * @example
 * // returns true
 * isDifferent(10, 10.02);
 */
export const isDifferent = (a: number, b: number, epsilon = 0.01) => {
  return !isSame(a, b, epsilon);
};

/**
 * Returns the modulo of a number that works correctly with negative numbers.
 * JavaScript's % operator returns a negative remainder when the dividend is negative.
 * This function always returns a positive remainder.
 *
 * @param n - The dividend (number to be divided).
 * @param modulo - The divisor (number to divide by).
 * @returns The positive remainder after division.
 *
 * @example
 * // returns 1
 * mod(5, 2);
 *
 * @example
 * // returns 1
 * mod(-5, 2);
 */
export const mod = (n: number, modulo: number) => {
  return ((n % modulo) + modulo) % modulo;
};
