import { DeepPartial } from './types.ts';

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
export const deepClone = <T>(target: T): T => {
  if (target === null) {
    return target;
  }

  if (target instanceof Date) {
    return new Date(target.getTime()) as T;
  }

  // T extends unknown[] specifies that T should be an array and would return T type
  if (Array.isArray(target)) {
    return (target as T extends unknown[] ? T : never).map(item => deepClone(item)) as T;
  }

  if (typeof target === 'object') {
    const cp = { ...(target as Record<string, unknown>) };
    Object.keys(cp).forEach(key => {
      cp[key] = deepClone(cp[key]);
    });
    return cp as T;
  }

  return target;
};
