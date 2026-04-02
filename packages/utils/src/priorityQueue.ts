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
 * A stable min-heap priority queue where elements with lower priority values are dequeued first.
 */
export class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number; sequence: number }> = [];
  private sequence = 0;

  /**
   * Adds an element to the queue with the given priority.
   * @param element The element to add
   * @param priority The priority value (lower values = higher priority)
   */
  enqueue(element: T, priority: number): void {
    this.items.push({ element, priority, sequence: this.sequence++ });
    this.bubbleUp(this.items.length - 1);
  }

  private bubbleUp(index: number): void {
    let currentIndex = index;

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.compare(this.items[currentIndex]!, this.items[parentIndex]!) >= 0) {
        return;
      }

      this.swap(currentIndex, parentIndex);
      currentIndex = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    let currentIndex = index;

    while (true) {
      const leftChildIndex = currentIndex * 2 + 1;
      const rightChildIndex = leftChildIndex + 1;
      let smallestIndex = currentIndex;

      if (
        leftChildIndex < this.items.length &&
        this.compare(this.items[leftChildIndex]!, this.items[smallestIndex]!) < 0
      ) {
        smallestIndex = leftChildIndex;
      }

      if (
        rightChildIndex < this.items.length &&
        this.compare(this.items[rightChildIndex]!, this.items[smallestIndex]!) < 0
      ) {
        smallestIndex = rightChildIndex;
      }

      if (smallestIndex === currentIndex) {
        return;
      }

      this.swap(currentIndex, smallestIndex);
      currentIndex = smallestIndex;
    }
  }

  /**
   * Removes and returns the element with the highest priority (lowest priority value).
   * @returns The highest priority element, or undefined if queue is empty
   */
  dequeue(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const root = this.items[0]!;
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return root.element;
  }

  /**
   * Checks if the queue is empty.
   * @returns true if the queue has no elements
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  private compare(
    a: { element: T; priority: number; sequence: number },
    b: { element: T; priority: number; sequence: number }
  ): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.sequence - b.sequence;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
  }
}
