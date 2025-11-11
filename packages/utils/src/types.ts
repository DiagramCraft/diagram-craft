/**
 * TypeScript utility types and type guards.
 *
 * @example
 * ```ts
 * import { DeepPartial, DeepReadonly, isEnum } from '@diagram-craft/utils/types';
 *
 * type Config = { server: { port: number; host: string } };
 *
 * // Make all properties optional recursively
 * const partial: DeepPartial<Config> = { server: { port: 3000 } };
 *
 * // Make all properties readonly recursively
 * const readonly: DeepReadonly<Config> = { server: { port: 3000, host: 'localhost' } };
 * ```
 *
 * @module
 */

/**
 * Makes all properties of a type writable recursively by removing the readonly modifier
 * from all properties and nested properties.
 *
 * @template T - The type to make deeply writable
 */
export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

/**
 * Makes all properties of a type readonly recursively by adding the readonly modifier
 * to all properties and nested properties.
 *
 * @template T - The type to make deeply readonly
 */
export type DeepReadonly<T> = { +readonly [P in keyof T]: DeepReadonly<T[P]> };

/**
 * Makes all properties of a type required recursively by removing the optional modifier
 * from all properties and nested properties.
 *
 * @template T - The type to make deeply required
 */
export type DeepRequired<T> = { [P in keyof T]-?: DeepRequired<T[P]> };

/**
 * Makes all properties of a type optional recursively by adding the optional modifier
 * to all properties and nested properties.
 *
 * @template T - The type to make deeply partial
 */
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

/**
 * Type assertion function to convert a deeply readonly object to a deeply writable one.
 * Note: This does not create a new object, it just changes the type.
 *
 * @template T - The type of the object
 * @param {DeepReadonly<T>} o - The readonly object to convert
 * @returns {DeepWriteable<T>} The same object but with a writable type
 */
export const makeWriteable = <T>(o: DeepReadonly<T>): DeepWriteable<T> => o as DeepWriteable<T>;

/**
 * Type guard function to check if a value is one of a set of string values.
 *
 * @template T - The string union type
 * @param {unknown} o - The value to check
 * @param {T[]} values - The array of valid string values
 * @returns {boolean} True if the value is one of the string values, false otherwise
 *
 * @example
 * if (isEnum(value, ['red', 'green', 'blue'])) {
 *   // value is typed as 'red' | 'green' | 'blue'
 * }
 */
export const isStringUnion = <T extends string>(o: unknown, values: T[]): o is T => {
  return !(typeof o !== 'string' || !values.includes(o as T));
};

/**
 * Represents an object with no properties.
 * Useful for typing objects that should be empty.
 */
export type EmptyObject = Record<string, never>;

/**
 * Represents an object with string keys and primitive values.
 * Useful for typing simple key-value objects.
 */
export type FlatObject = Record<string, string | number | boolean | undefined>;

/**
 * Represents a JSON-compatible value.
 * This type can be used to type values that will be serialized to JSON.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Represents a non-empty array (at least one element).
 *
 * @template T - The type of array elements
 */
export type NoneEmptyArray<T> = [T, ...T[]];

/**
 * Represents an array with exactly N elements.
 *
 * @template T - The type of array elements
 * @template L - The exact number of elements
 */
export type NElementArray<T, L extends number, D extends NoneEmptyArray<T> = [T]> = L extends number
  ? number extends L
    ? NoneEmptyArray<T>
    : L extends D['length']
      ? D
      : NElementArray<T, L, [T, ...D]>
  : never;

/**
 * Represents an array with at least N elements.
 *
 * @template T - The type of array elements
 * @template L - The minimum number of elements
 */
export type NOrMoreElementArray<
  T,
  L extends number,
  D extends NoneEmptyArray<T> = [T]
> = L extends number
  ? number extends L
    ? NoneEmptyArray<T>
    : L extends D['length']
      ? [...D, ...T[]]
      : NOrMoreElementArray<T, L, [T, ...D]>
  : never;

/**
 * Makes specific properties of a type required by removing the optional modifier
 * from the specified keys.
 *
 * @template T - The base type
 * @template K - The keys to make required
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
