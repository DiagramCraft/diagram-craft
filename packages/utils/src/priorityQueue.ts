/**
 * Priority queue data structure with min-heap behavior.
 *
 * @example
 * ```ts
 * import { PriorityQueue } from '@diagram-craft/utils/priorityQueue';
 *
 * const queue = new PriorityQueue<string>();
 * queue.enqueue('low', 10);
 * queue.enqueue('high', 1);
 * queue.enqueue('medium', 5);
 *
 * queue.dequeue(); // 'high' (priority 1)
 * queue.dequeue(); // 'medium' (priority 5)
 * queue.dequeue(); // 'low' (priority 10)
 * ```
 *
 * @module
 */

/**
 * A priority queue implementation where elements with lower priority values are dequeued first.
 */
export class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number }> = [];

  /**
   * Adds an element to the queue with the given priority.
   * @param element The element to add
   * @param priority The priority value (lower values = higher priority)
   */
  enqueue(element: T, priority: number): void {
    const item = { element, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (item.priority < this.items[i]!.priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(item);
    }
  }

  /**
   * Removes and returns the element with the highest priority (lowest priority value).
   * @returns The highest priority element, or undefined if queue is empty
   */
  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.element;
  }

  /**
   * Checks if the queue is empty.
   * @returns true if the queue has no elements
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
