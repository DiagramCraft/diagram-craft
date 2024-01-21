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
