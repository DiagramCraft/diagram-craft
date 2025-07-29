/**
 * Round a number to 2 decimal places (for display purposes)
 */
export const round = (n: number) => {
  const res = Math.round(n * 100) / 100;
  // To ensure -0 === 0
  if (res === 0) return 0;
  return res;
};

// TODO: Merge this with round - and add a second parameter indicating precision
export const roundHighPrecision = (n: number) => {
  const res = Math.round(n * 10000) / 10000;
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
