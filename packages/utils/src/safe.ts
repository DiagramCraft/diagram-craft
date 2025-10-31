/**
 * Type-safe string parsing utilities with runtime validation.
 *
 * @example
 * ```ts
 * import { safeReMatch, safeSplit, safeTupleCast } from '@diagram-craft/utils/safe';
 *
 * // Parse with regex, ensure 3 matches
 * const [_, x, y] = safeReMatch('point(10,20)', /point\((\d+),(\d+)\)/, 3);
 *
 * // Split and ensure exact count
 * const [r, g, b] = safeSplit('255,128,64', ',', 3, 3);
 *
 * // Cast array to typed tuple
 * const coords = safeTupleCast([1, 2], 2); // [number, number]
 * ```
 *
 * @module
 */

import { assert } from './assert';
import type { NElementArray, NOrMoreElementArray } from './types';

/**
 * Matches a string against a regex and returns a typed array of matches.
 *
 * Asserts that the number of matches is within the specified range.
 *
 * @template M - The minimum number of expected matches
 * @param value - The string to match
 * @param re - The regular expression to match against
 * @param min - Minimum number of matches required
 * @param max - Optional maximum number of matches allowed
 * @returns Typed array of matches, or undefined if no match
 * @throws If the number of matches is outside the specified range
 *
 * @example
 * ```ts
 * const result = safeReMatch('rgb(255,0,128)', /rgb\((\d+),(\d+),(\d+)\)/, 4);
 * // result: [string, string, string, string] (full match + 3 groups)
 * ```
 */
export const safeReMatch = <M extends number>(value: string, re: RegExp, min: M, max?: number) => {
  const m = value.match(re);
  if (!m) return undefined;
  assert.true(m.length >= min && (max === undefined || m.length <= max));

  // Convert to plain array to remove RegExpMatchArray properties (index, input, groups)
  const plainArray = Array.from(m);

  if (max === undefined) {
    return plainArray as NElementArray<string, M>;
  } else {
    return plainArray as NOrMoreElementArray<string, M>;
  }
};

/**
 * Splits a string and returns a typed array with validated length.
 *
 * Asserts that the number of parts is within the specified range.
 *
 * @template M - The minimum number of expected parts
 * @param value - The string to split
 * @param sep - The separator to split on
 * @param min - Minimum number of parts required
 * @param max - Optional maximum number of parts allowed
 * @returns Typed array of string parts
 * @throws If the number of parts is outside the specified range
 *
 * @example
 * ```ts
 * const [x, y, z] = safeSplit('10,20,30', ',', 3, 3);
 * // Type: [string, string, string]
 * ```
 */
export const safeSplit = <M extends number>(value: string, sep: string, min: M, max?: number) => {
  const r = value.split(sep);
  assert.true(r.length >= min && (max === undefined || r.length <= max));

  if (max === undefined) {
    return r as NElementArray<string, M>;
  } else {
    return r as NOrMoreElementArray<string, M>;
  }
};

/**
 * Casts an array to a typed tuple of exact length.
 *
 * Asserts that the array has exactly the specified number of elements.
 *
 * @template M - The expected number of elements
 * @template T - The type of array elements
 * @param value - The array to cast
 * @param n - The expected number of elements
 * @returns The array cast to a typed tuple
 * @throws If the array length doesn't match n
 *
 * @example
 * ```ts
 * const point = safeTupleCast([10, 20], 2);
 * // Type: [number, number]
 * ```
 */
export const safeTupleCast = <M extends number, T>(value: T[], n: M) => {
  assert.true(value.length === n);
  return value as NElementArray<T, M>;
};
