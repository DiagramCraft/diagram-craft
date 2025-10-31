/**
 * Lazy evaluation with optional caching.
 *
 * @example
 * ```ts
 * import { Lazy } from '@diagram-craft/utils/lazy';
 *
 * const expensive = new Lazy(() => {
 *   console.log('Computing...');
 *   return 42;
 * });
 *
 * expensive.get(); // Logs "Computing..." and returns 42
 * expensive.get(); // Returns cached 42 (no log)
 * ```
 *
 * @example Conditional caching with NoCache
 * ```ts
 * const conditional = new Lazy(() => {
 *   const value = Math.random();
 *   // Only cache values above 0.5
 *   if (value > 0.5) {
 *     return value;
 *   }
 *   return new Lazy.NoCache(value);
 * });
 *
 * conditional.get(); // Computes and may cache
 * conditional.get(); // Uses cache only if first value was > 0.5
 * ```
 *
 * @module
 */

/**
 * Wrapper for values that should not be cached.
 *
 * Return this from a Lazy function to prevent the result from being cached,
 * forcing recomputation on every access.
 *
 * @template T - The type of the uncached value
 *
 * @example
 * ```ts
 * const timestamp = new Lazy(() => {
 *   // Always get fresh timestamp, never cache
 *   return new Lazy.NoCache(Date.now());
 * });
 * ```
 */
export class NoCache<T> {
  constructor(public readonly v: T) {}
}

/**
 * A class representing a lazily evaluated value.
 * The value is computed and stored only upon the first access.
 * Subsequent accesses return the cached value unless cleared.
 *
 * @template T The type of the value to be lazily evaluated.
 */
export class Lazy<T> {
  private _value: T | undefined;

  static NoCache = NoCache;

  constructor(
    private readonly fn: () => T | NoCache<T>,
    v?: T
  ) {
    this._value = v;
  }

  /**
   * Retrieves the value stored in the `_value` property, if available.
   * If the value is not cached, it invokes the `fn` function to compute the value.
   * If the computed value is an instance of `NoCache`, the value is not cached
   * Otherwise, the computed value is cached for subsequent invocations of get()
   *
   * @return {T} The retrieved or computed value.
   */
  get(): T {
    if (this._value) return this._value;
    const r = this.fn();
    if (r instanceof NoCache) {
      return r.v;
    } else {
      this._value = r;
    }
    return this._value;
  }

  /**
   * Checks if the cache is populated
   *
   * @return Returns true if the cache is populated
   */
  hasValue() {
    return this._value !== undefined;
  }

  /**
   * Clears the current cached value
   *
   * @return This method does not return anything.
   */
  clear() {
    this._value = undefined;
  }
}
