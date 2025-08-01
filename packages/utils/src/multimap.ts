/**
 * A data structure that maps keys to multiple values.
 * Unlike a regular Map where each key maps to a single value,
 * MultiMap allows multiple values to be associated with a single key.
 */
export class MultiMap<K, V> {
  /**
   * The underlying Map that stores arrays of values for each key.
   */
  private delegate: Map<K, V[]> = new Map();

  /**
   * Returns all values associated with the given key.
   * @param k - The key to look up
   * @returns An array of values associated with the key, or an empty array if the key doesn't exist
   */
  get(k: K): V[] {
    return this.delegate.get(k) ?? [];
  }

  /**
   * Adds a value to the collection of values associated with the given key.
   * @param k - The key to associate the value with
   * @param v - The value to add
   */
  add(k: K, v: V) {
    if (!this.delegate.has(k)) {
      this.delegate.set(k, [v]);
    } else {
      this.delegate.get(k)!.push(v);
    }
  }

  /**
   * Removes a specific value from the collection associated with the given key.
   * If the value is the last one for the key, the key remains in the map with an empty array.
   * @param k - The key from which to remove the value
   * @param v - The value to remove
   */
  remove(k: K, v: V) {
    const values = this.delegate.get(k);
    if (values) {
      const index = values.indexOf(v);
      if (index >= 0) {
        values.splice(index, 1);
      }
    }
  }

  /**
   * Checks if the given key has any associated values.
   * @param k - The key to check
   * @returns True if the key exists and has at least one value, false otherwise
   */
  has(k: K) {
    return this.get(k).length > 0;
  }

  keys() {
    return this.delegate.keys();
  }

  entries() {
    return this.delegate.entries();
  }
}
