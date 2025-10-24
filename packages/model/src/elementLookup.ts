import type { DiagramElement } from './diagramElement';

/**
 * A type-safe lookup table for diagram elements (nodes and edges) indexed by their unique ID.
 *
 * This class provides efficient O(1) lookup, insertion, and deletion operations for diagram
 * elements. It's used internally by the Diagram class to maintain separate registries for
 * nodes and edges.
 *
 * @template T - The type of diagram element (must extend DiagramElement)
 *
 * @example
 * const nodeLookup = new ElementLookup<DiagramNode>();
 * nodeLookup.set('node-123', myNode);
 * const node = nodeLookup.get('node-123');
 */
export class ElementLookup<T extends DiagramElement> {
  /** Internal Map storing elements indexed by their string ID */
  readonly #lookup = new Map<string, T>();

  /**
   * Retrieves an element by its unique ID.
   *
   * @param id - The unique identifier of the element
   * @returns The element if found, undefined otherwise
   */
  get(id: string): T | undefined {
    return this.#lookup.get(id);
  }

  /**
   * Adds or updates an element in the lookup table.
   * If an element with the same ID already exists, it will be replaced.
   *
   * @param id - The unique identifier of the element
   * @param element - The diagram element to store
   */
  set(id: string, element: T) {
    this.#lookup.set(id, element);
  }

  /**
   * Removes an element from the lookup table by its ID.
   * This operation is idempotent - calling it multiple times with the same ID is safe.
   *
   * @param id - The unique identifier of the element to remove
   */
  delete(id: string) {
    this.#lookup.delete(id);
  }

  /**
   * Checks whether an element with the given ID exists in the lookup table.
   *
   * @param id - The unique identifier to check
   * @returns true if an element with this ID exists, false otherwise
   */
  has(id: string) {
    return this.#lookup.has(id);
  }

  /**
   * Returns an iterator over all elements in the lookup table.
   * The order of iteration is insertion order.
   *
   * @returns An iterator over the stored elements
   */
  values() {
    return this.#lookup.values();
  }

  /**
   * Returns an iterator over all element IDs in the lookup table.
   * The order of iteration is insertion order.
   *
   * @returns An iterator over the element IDs
   */
  keys() {
    return this.#lookup.keys();
  }
}
