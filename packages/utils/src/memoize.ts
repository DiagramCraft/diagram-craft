/**
 * Function memoization utilities.
 *
 * @example
 * ```ts
 * import { makeMemo } from '@diagram-craft/utils/memoize';
 *
 * const memo = makeMemo<number>();
 * const result1 = memo(() => expensiveComputation()); // Computes
 * const result2 = memo(() => expensiveComputation()); // Returns cached
 * ```
 *
 * @module
 */

// TODO: Significant overlap with lazy.ts
/**
 * Creates a memoization function that caches the result of a computation.
 *
 * The returned function will execute the provided computation only once and cache
 * the result. Subsequent calls return the cached value regardless of the function
 * passed in.
 *
 * @template T - The type of the value to be memoized
 * @returns A memoization function that caches the first computation result
 *
 * @deprecated Use {@link Lazy} from `@diagram-craft/utils/lazy` instead.
 * Lazy provides the same functionality with additional features like cache clearing
 * and conditional caching.
 *
 * @example
 * ```ts
 * const memo = makeMemo<string>();
 *
 * const value1 = memo(() => {
 *   console.log('Computing...');
 *   return 'result';
 * }); // Logs "Computing..." and returns "result"
 *
 * const value2 = memo(() => 'different'); // Returns cached "result"
 * ```
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
