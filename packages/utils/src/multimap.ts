/**
 * MultiMap data structure for mapping keys to multiple values.
 *
 * @example
 * ```ts
 * import { MultiMap } from '@diagram-craft/utils/multimap';
 *
 * const map = new MultiMap<string, number>();
 * map.add('ids', 95);
 * map.add('ids', 87);
 * map.get('ids'); // [95, 87]
 * ```
 *
 * @module
 */

/**
 * A data structure that maps keys to multiple values.
 * Unlike a regular Map where each key maps to a single value,
 * MultiMap allows multiple values to be associated with a single key.
 *
 * @template K - The type of keys
 * @template V - The type of values
 *
 * @example
 * ```ts
 * const shapesByColor = new MultiMap<string, DiagramNode>();
 *
 * // Group shapes by their fill color
 * shapesByColor.add('red', node1);
 * shapesByColor.add('red', node2);
 * shapesByColor.add('blue', node3);
 *
 * // Get all red shapes
 * shapesByColor.get('red'); // [node1, node2]
 * shapesByColor.get('blue'); // [node3]
 * shapesByColor.get('green'); // []
 *
 * // Check if any shapes have a color
 * shapesByColor.has('red'); // true
 * shapesByColor.has('green'); // false
 *
 * // Remove a specific shape from a color group
 * shapesByColor.remove('red', node1);
 * shapesByColor.get('red'); // [node2]
 * ```
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

  /**
   * Returns an iterator of all keys in the multimap.
   *
   * @returns An iterator over the keys
   */
  keys() {
    return this.delegate.keys();
  }

  /**
   * Returns an iterator of key-value array pairs.
   *
   * @returns An iterator over [key, values[]] pairs
   */
  entries() {
    return this.delegate.entries();
  }

  /**
   * Removes all key-value pairs from the multimap.
   */
  clear() {
    this.delegate.clear();
  }
}
