/**
 * Creates a memoization function that caches the result of a computation.
 *
 * @template T - The type of the value to be memoized.
 * @returns {function(): T} - A function that takes a computation function `fn` and returns the memoized result.
 */
export const makeMemo = <T>() => {
  let value: T | undefined;
  return (fn: () => T): T => {
    if (value === undefined) {
      value = fn();
    }
    return value;
  };
};
