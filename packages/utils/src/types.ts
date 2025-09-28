/**
 * Makes all properties of a type writable by removing the readonly modifier.
 *
 * @template T - The type to make writable
 */
export type Writeable<T> = { -readonly [k in keyof T]: T[k] };

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
 * Type guard function to check if a value is one of a set of enum values.
 *
 * @template T - The type of the enum values (must be a string)
 * @param {unknown} o - The value to check
 * @param {T[]} values - The array of valid enum values
 * @returns {boolean} True if the value is one of the enum values, false otherwise
 *
 * @example
 * enum Color { Red = 'red', Blue = 'blue' }
 * const values = Object.values(Color);
 * if (isEnum(value, values)) {
 *   // value is typed as Color
 * }
 */
export const isEnum = <T extends string>(o: unknown, values: T[]): o is T => {
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
 * Represents a nested object of any shape.
 * @deprecated Use more specific types instead of this generic type.
 */
// eslint-disable-next-line
export type NestedObject = any;

export type NoneEmptyArray<T> = [T, ...T[]];

export type NElementArray<T, L extends number, D extends NoneEmptyArray<T> = [T]> = L extends number
  ? number extends L
    ? NoneEmptyArray<T>
    : L extends D['length']
      ? D
      : NElementArray<T, L, [T, ...D]>
  : never;

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
