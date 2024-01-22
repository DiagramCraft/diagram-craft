import { DeepPartial } from './types.ts';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object';

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
