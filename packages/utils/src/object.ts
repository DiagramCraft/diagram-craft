/**
 * Object manipulation utilities for deep operations.
 *
 * @example
 * ```ts
 * import { deepClone, deepEquals, deepMerge } from '@diagram-craft/utils/object';
 *
 * const original = { a: 1, b: { c: 2 } };
 * const clone = deepClone(original);
 * const merged = deepMerge({ a: 1 }, { b: 2 });
 * const same = deepEquals(original, clone); // true
 * ```
 *
 * @module
 */

import { DeepPartial, type DeepReadonly, type DeepWriteable } from './types';

// biome-ignore lint/suspicious/noExplicitAny: false positive
type Props = Record<string, any>;

/**
 * Type guard to check if a value is a plain object.
 *
 * @param x - The value to check
 * @returns True if the value is a plain object
 */
export const isObj = (x: unknown): x is Record<string, unknown> => isObject(x);

const isObject = (item: unknown) => typeof item === 'object' && !Array.isArray(item);

/**
 * This function takes two objects of the same type and returns a new object that only includes the properties that have the same values in both input objects.
 * If a property value is an object, the function is called recursively for that property.
 * The function uses the `DeepPartial` type to allow properties to be optional and to be of any type.
 *
 * @param a - The first object to compare.
 * @param b - The second object to compare.
 * @returns A new object that only includes the properties that have the same values in both input objects.
 * @template T - The type of the input objects. Must be an object type.
 */
export const common = <T extends Record<string, unknown>>(a: T, b: T): DeepPartial<T> => {
  // The result object that will be returned.
  const result: Partial<T> = {};

  // Check if both inputs are objects.
  if ([a, b].every(isObj)) {
    // Iterate over the keys of the first object.
    Object.keys(a).forEach(key => {
      // Get the value of the current key in both objects.
      const value = a[key];
      const other = b[key];

      // If the value of the current key is an object in both objects, call the function recursively.
      if (isObj(value) && isObj(other)) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        (result as any)[key] = common(value, other);
      }
      // If the value of the current key is the same in both objects, add it to the result object.
      else if (value === other) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        (result as any)[key] = value;
      }
    });
  }

  // Return the result object.
  return result;
};

/**
 * Deeply merges multiple source objects into a target object.
 *
 * Recursively merges nested objects, with later sources overwriting earlier ones.
 * Null values are skipped during merging.
 *
 * @template T - The type of the objects to merge
 * @param target - The target object to merge into
 * @param sources - One or more source objects to merge
 * @returns The merged object
 *
 * @example
 * ```ts
 * const base = { a: 1, b: { c: 2 } };
 * const override = { b: { d: 3 }, e: 4 };
 * const result = deepMerge(base, override);
 * // Result: { a: 1, b: { c: 2, d: 3 }, e: 4 }
 * ```
 */
export const deepMerge = <T extends Props>(
  target: Partial<T>,
  ...sources: Array<Partial<T> | undefined>
): T => {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  const result: any = target;

  if (!isObject(result)) return target as T;

  for (const elm of sources) {
    if (!isObject(elm)) continue;
    if (elm === undefined) continue;

    for (const key of Object.keys(elm)) {
      if (elm[key] === null) continue;
      if (isObject(elm[key])) {
        result[key] ??= {};
        deepMerge(result[key], elm[key] as Props);
      } else if (elm[key] !== undefined) {
        result[key] = elm[key];
      }
    }
  }

  return result as T;
};

/**
 * Creates a deep clone of the provided target object.
 *
 * This function uses the browser's native `structuredClone` algorithm by default,
 * but supports custom cloning behavior through the {@link deepCloneOverride} symbol.
 * If an object has a function defined at the `deepCloneOverride` property, that
 * function will be called instead of using `structuredClone`.
 *
 * **Note:** The override only applies to the top-level object being cloned. Nested
 * objects with overrides inside a parent object will not have their override functions
 * called - they will be cloned using `structuredClone` along with the parent.
 *
 * @param v - The object to clone
 * @returns A deep clone of the target object
 *
 * @example
 * // Standard cloning
 * deepClone({ a: 1, b: 2 });
 *
 * @example
 * // Array cloning
 * deepClone([1, 2, 3]);
 *
 * @example
 * // Date cloning
 * deepClone(new Date());
 *
 * @example
 * // Custom clone behavior using deepCloneOverride
 * const obj = {
 *   data: 'value',
 *   [deepCloneOverride]: function() {
 *     return { data: this.data, cloned: true };
 *   }
 * };
 * const clone = deepClone(obj); // { data: 'value', cloned: true }
 */
export const deepClone = <T>(v: T): T =>
  // @ts-expect-error we check for existence, so this is ok
  v?.[deepCloneOverride] ? v[deepCloneOverride]() : structuredClone(v);

/**
 * Symbol used to define a custom clone function on objects that need special
 * cloning behavior beyond the standard `structuredClone` algorithm.
 *
 * Objects can implement a method at this property to control how they are cloned
 * when passed to {@link deepClone}. This is useful for:
 * - Proxy objects that need to return their underlying data
 * - Objects with non-cloneable properties (like functions)
 * - Objects that need custom serialization logic
 * - Performance optimization for large objects
 *
 * The override function is called on the object being cloned and should return
 * the cloned value. It has access to `this` context of the original object.
 *
 * **Important:** The override only works at the top level of the cloned object.
 * If a parent object without an override contains nested objects with overrides,
 * those nested overrides will not be invoked.
 *
 * @example
 * // Simple override returning a modified clone
 * const obj = {
 *   value: 42,
 *   [deepCloneOverride]: function() {
 *     return { value: this.value, timestamp: Date.now() };
 *   }
 * };
 *
 * @example
 * // Class implementing custom clone behavior
 * class CustomData {
 *   constructor(public data: string) {}
 *
 *   [deepCloneOverride]() {
 *     return { data: this.data, type: 'CustomData' };
 *   }
 * }
 */
export const deepCloneOverride = '__deepCloneOverride';

/**
 * Creates a deep clone of the provided target object. It handles objects such as
 * window that is not compatible with the structured clone algorithm.
 *
 * @param target - The object to be cloned.
 * @returns A deep clone of the target object.
 *
 * @example
 * // returns a new object with the same properties as the original
 * resilientDeepClone({ a: 1, b: 2 });
 *
 * @example
 * // returns a new array with the same elements as the original
 * resilientDeepClone([1, 2, 3]);
 *
 * @example
 * // returns a new date object with the same time as the original
 * resilientDeepClone(new Date());
 */
export const resilientDeepClone = <T>(target: T): T => {
  if (target === null) {
    return target;
  }

  if (target instanceof Date) {
    return new Date(target.getTime()) as T;
  }

  // T extends unknown[] specifies that T should be an array and would return T type
  if (Array.isArray(target)) {
    return (target as T extends unknown[] ? T : never).map(item => resilientDeepClone(item)) as T;
  }

  if (typeof target === 'object') {
    const cp = { ...(target as Record<string, unknown>) };
    Object.keys(cp).forEach(key => {
      cp[key] = resilientDeepClone(cp[key]);
    });
    return cp as T;
  }

  return target;
};

/**
 * Compares two objects and returns `true` if they are deeply equal, `false` otherwise.
 *
 * @param a - object 1
 * @param b - object 2
 *
 * @returns `true` if the objects are deeply equal, `false` otherwise
 *
 * @example
 * deepEquals({ a: 1, b: 2 }, { a: 1, b: 2 }); // returns true
 *
 * @example
 * deepEquals({ a: 1, b: 2 }, { a: 1, b: 3 }); // returns false
 *
 */
export const deepEquals = <T>(a: T, b: T): boolean => {
  if (a === b) return true;

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;

  const keysA = getTypedKeys(a);
  const keysB = getTypedKeys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.hasOwn(b, key) || !deepEquals(a[key], b[key])) return false;
  }

  return true;
};

/**
 * Performs a shallow equality check between two objects of the same type.
 *
 * This function checks if the two input objects have the same keys and the same values for each key.
 * The function does not check nested properties of the objects, i.e., if a property value is an object,
 * the function does not check the equality of the properties of this object (hence the term "shallow").
 *
 * @param a - The first object to compare.
 * @param b - The second object to compare.
 * @returns A boolean indicating whether the two objects are shallowly equal.
 *
 * @example
 * // returns true
 * shallowEquals({ a: 1, b: 2 }, { a: 1, b: 2 });
 *
 * @example
 * // returns false
 * shallowEquals({ a: 1, b: 2 }, { a: 1, b: 3 });
 *
 * @template T - The type of the input objects. Must be an object type.
 */
export const shallowEquals = <T>(a: T, b: T): boolean => {
  if (a === b) return true;

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;

  const keysA = getTypedKeys(a);
  const keysB = getTypedKeys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.hasOwn(b, key) || a[key] !== b[key]) return false;
  }

  return true;
};

/**
 * Removes all properties from the target object that exist in the source object. This function
 * performs a deep comparison and removal, meaning that if a property value is an object,
 * it will recursively remove matching properties from the nested objects as well.
 *
 * @param source - The object containing properties to be removed from the target.
 * @param target - The object from which properties will be removed.
 * @template T - The type of the objects, extending a generic `Props` type which is a record of string keys to any value.
 *
 * @example
 * // Assuming `source` is { a: 1, b: { c: 2 } } and `target` is { a: 1, b: { c: 2, d: 3 } },
 * // the function will modify target to be { b: { d: 3 } }.
 * */
export const deepClear = <T extends Props>(source: T, target: T) => {
  for (const key of Object.keys(source)) {
    if (source[key] === null) continue;
    if (isObject(source[key])) {
      if (isObject(target[key])) {
        deepClear(source[key] as Props, target[key] as Props);
      }
    } else {
      delete target[key];
    }
  }
};

/**
 * Checks if an object is deeply empty (has no non-null/undefined values).
 *
 * Recursively checks nested objects. An object is considered empty if all
 * its properties are null, undefined, or empty objects.
 *
 * @param obj - The object to check
 * @returns True if the object is deeply empty
 *
 * @example
 * ```ts
 * deepIsEmpty({}); // true
 * deepIsEmpty({ a: null }); // true
 * deepIsEmpty({ a: { b: undefined } }); // true
 * deepIsEmpty({ a: 1 }); // false
 * deepIsEmpty({ a: { b: 2 } }); // false
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: false positive
export const deepIsEmpty = (obj: any | undefined | null) => {
  if (obj === null || obj === undefined) return true;

  for (const key of Object.keys(obj)) {
    if (obj[key] === null || obj[key] === undefined) continue;
    if (isObject(obj[key])) {
      if (!deepIsEmpty(obj[key])) return false;
    } else {
      return false;
    }
  }

  return true;
};

/**
 * Recursively unfolds a nested object into a flat key-value mapping where
 * keys represent the path to the original nested property.
 *
 * @param dest  - The destination object where unfolded key-value pairs are stored.
 * @param value - The current value to process, which may be an object or a primitive.
 * @param path  - An array representing the current path within the nested object.
 *                Defaults to an empty array for initial calls.
 */
export const unfoldObject = (
  dest: Record<string, unknown>,
  value: unknown,
  path: string[] = []
): Record<string, unknown> => {
  if (value !== null && isObj(value)) {
    for (const key of Object.keys(value)) {
      unfoldObject(dest, value[key], [...path, key]);
    }
  } else {
    dest[path.join('.')] = value;
  }
  return dest;
};

/**
 * Checks if a value is a primitive type (null, undefined, string, number, boolean) or a Uint8Array.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a primitive type or Uint8Array, `false` otherwise.
 *
 * @example
 *  isPrimitive('hello'); // returns true
 *  isPrimitive(42); // returns true
 *  isPrimitive({}); // returns false
 */
export const isPrimitive = (value: unknown) => {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Uint8Array
  );
};

/**
 * Clones a deeply readonly object and returns it as a writable type.
 *
 * This is an alias for {@link deepClone} with type casting to remove readonly modifiers.
 *
 * @template T - The type of the object
 * @param o - The readonly object to clone
 * @returns A writable deep clone of the object
 *
 * @example
 * ```ts
 * const readonly: DeepReadonly<{ a: number }> = { a: 1 };
 * const writable = cloneAsWriteable(readonly);
 * writable.a = 2; // OK, now writable
 * ```
 */
export const cloneAsWriteable: <T>(o: DeepReadonly<T>) => DeepWriteable<T> = deepClone;

/**
 * A utility function that acts as a type-safe wrapper around `Object.keys`.
 * Returns an array of keys from the provided object with type-checking, ensuring
 * the keys are strictly typed based on the given object's shape.
 *
 * This ensures that the returned keys are constrained to the actual keys
 * of the object and provides more accurate typings for TypeScript usage.
 *
 * @typeParam T - The object type from which keys will be retrieved.
 * @param obj - The object whose keys are to be retrieved.
 * @returns An array containing the keys of the given object, typed as keys of T.
 */
export const getTypedKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>;
