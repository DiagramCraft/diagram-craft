/**
 * Returns the smallest element in an array based on a provided comparator function.
 *
 * @param arr - The array to be processed.
 * @param comparator - The comparator function used to determine the order of elements.
 * @returns The smallest element in the array according to the comparator function. Returns undefined if the array is empty.
 *
 * @example
 * // returns 1
 * smallest([3, 1, 4], (a, b) => a - b);
 *
 * @example
 * // returns 'apple'
 * smallest(['apple', 'banana', 'cherry'], (a, b) => a.localeCompare(b));
 */
export const smallest = <T>(
  arr: ReadonlyArray<T>,
  comparator: (a: T, b: T) => number
): T | undefined => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) < 0 ? acc : cur), arr[0]);
};

/**
 * Returns the index of the smallest element in an array.
 *
 * @param a - The array to be processed.
 * @returns The index of the smallest element in the array. Returns 0 if the array is empty.
 *
 * @example
 * // returns 1
 * smallestIndex([3, 1, 4]);
 *
 * @example
 * // returns 0
 * smallestIndex([42]);
 */
export const smallestIndex = <T>(a: ReadonlyArray<T>) => {
  let lowest = 0;
  for (let i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
  }
  return lowest;
};

/**
 * Returns the largest element in an array based on a provided comparator function.
 *
 * @param arr - The array to be processed.
 * @param comparator - The comparator function used to determine the order of elements.
 * @returns The largest element in the array according to the comparator function. Returns undefined if the array is empty.
 *
 * @example
 * // returns 4
 * largest([3, 1, 4], (a, b) => a - b);
 *
 * @example
 * // returns 'cherry'
 * largest(['apple', 'banana', 'cherry'], (a, b) => a.localeCompare(b));
 */
export const largest = <T>(
  arr: ReadonlyArray<T>,
  comparator: (a: T, b: T) => number
): T | undefined => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) > 0 ? acc : cur), arr[0]);
};

/**
 * Returns a new array with duplicates removed. The uniqueness of elements is determined based on the return value of the `respectTo` function.
 *
 * @param arr - The array to be processed.
 * @param [respectTo=(a => a)] - The function used to determine the uniqueness of elements. By default, it is the identity function.
 * @returns A new array with duplicates removed.
 *
 * @example
 * // returns [1, 2, 3]
 * unique([1, 2, 2, 3, 3, 3]);
 *
 * @example
 * // returns [{ id: 1 }, { id: 2 }]
 * unique([{ id: 1 }, { id: 2 }, { id: 2 }], e => e.id);
 */
export const unique = <T>(arr: ReadonlyArray<T>, respectTo: (e: T) => unknown = a => a): T[] => {
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    const key = respectTo(e);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result;
};

/**
 * Groups the elements of an array into a Map based on the return value of the `respectTo` function.
 *
 * @param arr - The array to be processed.
 * @param respectTo - The function used to determine the key for each element.
 * @returns A Map where the keys are the return values of the `respectTo` function and the values are arrays of elements that returned the corresponding key.
 *
 * @example
 * // returns new Map([[1, ['a', 'b']], [2, ['c']]])
 * groupBy(['a', 'b', 'c'], e => e.charCodeAt(0) % 2);
 */
export const groupBy = <T, K>(arr: ReadonlyArray<T>, respectTo: (e: T) => K): Map<K, Array<T>> => {
  const dest = new Map<K, Array<T>>();
  for (const e of arr) {
    const key = respectTo(e);
    const arr = dest.get(key) ?? [];
    arr.push(e);
    dest.set(key, arr);
  }
  return dest;
};

/**
 * Generates an array of numbers within a specified range.
 *
 * @param {number} start - The start of the range.
 * @param {number} end - The end of the range.
 * @returns {number[]} An array of numbers from start to end (exclusive).
 *
 * @example
 * // returns [2, 3, 4]
 * range(2, 5);
 */
export const range = (start: number, end: number) => {
  return Array.from({ length: end - start }, (_v, k) => k + start);
};

/**
 * Checks if two arrays have the same elements.
 *
 * This function checks if two arrays have the same elements, regardless of their order.
 * It first checks if the lengths of the arrays are equal. If they are not, it returns false.
 * Then, it checks if all elements in the first array exist in the second array. If any element does not exist, it returns false.
 * Finally, it checks if all elements in the second array exist in the first array. If any element does not exist, it returns false.
 * If all checks pass, it returns true, indicating that the two arrays have the same elements.
 *
 * @param a - The first array to be compared.
 * @param b - The second array to be compared.
 * @returns A boolean indicating whether the two arrays have the same elements.
 *
 * @example
 * // returns true
 * hasSameElements([1, 2, 3], [3, 2, 1]);
 *
 * @example
 * // returns false
 * hasSameElements([1, 2, 3], [1, 2, 4]);
 */
export const hasSameElements = <T>(a: T[], b: T[]) => {
  if (a.length !== b.length) return false;

  // Check all elements in a exists in b
  for (const e of a) {
    if (!b.includes(e)) return false;
  }

  // Check all elements in b exists in a
  for (const e of b) {
    if (!a.includes(e)) return false;
  }

  return true;
};
