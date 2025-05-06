class NoCache<T> {
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
   * @return {boolean} Returns true if the cache is populated
   */
  hasValue() {
    return this._value !== undefined;
  }

  /**
   * Clears the current cached value
   *
   * @return {void} This method does not return anything.
   */
  clear() {
    this._value = undefined;
  }
}
