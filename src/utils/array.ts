/**
 * Returns the first element of an array that satisfies the provided testing function.
 */
export const smallest = <T>(arr: ReadonlyArray<T>, comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) < 0 ? acc : cur), arr[0]);
};

/**
 * Returns the index of the smallest element in an array.
 */
export const smallestIndex = <T>(a: ReadonlyArray<T>) => {
  let lowest = 0;
  for (let i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
  }
  return lowest;
};

/**
 * Returns the index of the largest element in an array.
 */
export const largest = <T>(arr: ReadonlyArray<T>, comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) > 0 ? acc : cur), arr[0]);
};

/**
 * Return a new array with duplicates removed (based on the return value of respectTo).
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
 * Returns a Map grouping the elements of an array by the return value of respectTo.
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
