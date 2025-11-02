/**
 * Number parsing and string conversion utilities.
 *
 * @example
 * ```ts
 * import { parseNum, numberToString } from '@diagram-craft/utils/number';
 *
 * const value = parseNum('42'); // 42
 * const fallback = parseNum('invalid', 10); // 10
 * const str = numberToString(42); // '42'
 * ```
 *
 * @module
 */

/**
 * Parses a string to a number with a fallback value for invalid inputs.
 *
 * @param str - The string to parse (can be undefined or null)
 * @param def - The default value to return if parsing fails (default: 0)
 * @returns The parsed number or the default value
 *
 * @example
 * ```ts
 * parseNum('123'); // 123
 * parseNum('invalid'); // 0
 * parseNum('invalid', 42); // 42
 * parseNum(null, 10); // 10
 * parseNum(undefined, 5); // 5
 * ```
 */
export const parseNum = (str: string | undefined | null, def = 0) => {
  if (str === null) return def;
  const n = Number(str);
  return Number.isNaN(n) ? def : n;
};

/**
 * Type representing a string that contains a number.
 */
export type NumericalString = `${number}`;

/**
 * Converts a number to a typed numerical string.
 *
 * @param n - The number to convert
 * @returns The number as a NumericalString type
 *
 * @example
 * ```ts
 * const str = numberToString(42); // '42'
 * const negative = numberToString(-10); // '-10'
 * const decimal = numberToString(3.14); // '3.14'
 * ```
 */
export const numberToString = (n: number): NumericalString => {
  return n.toString() as NumericalString;
};
