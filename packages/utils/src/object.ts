import { DeepPartial } from './types';

// eslint-disable-next-line
type Props = Record<string, any>;

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
        // eslint-disable-next-line
        (result as any)[key] = common(value, other);
      }
      // If the value of the current key is the same in both objects, add it to the result object.
      else if (value === other) {
        // eslint-disable-next-line
        (result as any)[key] = value;
      }
    });
  }

  // Return the result object.
  return result;
};

export const deepMerge = <T extends Props>(target: Partial<T>, ...sources: Partial<T>[]): T => {
  // eslint-disable-next-line
  const result: any = target;

  if (!isObject(result)) return target as T;

  for (const elm of sources) {
    if (!isObject(elm)) continue;

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

  return result;
};

/**
 * Creates a deep clone of the provided target object.
 *
 * @param target - The object to be cloned.
 * @returns A deep clone of the target object.
 *
 * @example
 * // returns a new object with the same properties as the original
 * deepClone({ a: 1, b: 2 });
 *
 * @example
 * // returns a new array with the same elements as the original
 * deepClone([1, 2, 3]);
 *
 * @example
 * // returns a new date object with the same time as the original
 * deepClone(new Date());
 */
export const deepClone = structuredClone;

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

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    // @ts-ignore
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEquals(a[key], b[key])) return false;
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

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    // @ts-ignore
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) return false;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
