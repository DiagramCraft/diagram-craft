/**
 * A data structure that maps keys to values while preserving the order of insertion.
 * Unlike a regular Map, SortedMap guarantees that entries are returned in the order they were added.
 */
export class SortedMap<K, V> {
  /**
   * The underlying Map that stores values for each key.
   */
  private delegate: Map<K, V> = new Map();

  /**
   * Array to keep track of keys in the order they were added.
   */
  private keyOrder: K[] = [];

  /**
   * Adds a value associated with the given key.
   * If the key already exists, its value is updated but its position in the order is preserved.
   * @param k - The key to associate the value with
   * @param v - The value to add
   */
  add(k: K, v: V) {
    if (!this.delegate.has(k)) {
      this.keyOrder.push(k);
    }
    this.delegate.set(k, v);
  }

  /**
   * Checks if the given key exists in the map.
   * @param k - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(k: K): boolean {
    return this.delegate.has(k);
  }

  /**
   * Returns an iterator of all keys in the map in the order they were added.
   * @returns An iterator of keys
   */
  keys(): IterableIterator<K> {
    return this.keyOrder[Symbol.iterator]();
  }

  /**
   * Returns an iterator of all key-value pairs in the map in the order keys were added.
   * @returns An iterator of key-value pairs
   */
  entries(): IterableIterator<[K, V]> {
    const map = this.delegate;
    const keyOrder = this.keyOrder;
    
    return (function* () {
      for (const key of keyOrder) {
        yield [key, map.get(key)!] as [K, V];
      }
    })();
  }
}