import { describe, test, expect } from 'vitest';
import { PriorityQueue } from './priorityQueue';

describe('PriorityQueue', () => {
  test('enqueues and dequeues elements in priority order', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act
    queue.enqueue('low', 3);
    queue.enqueue('high', 1);
    queue.enqueue('medium', 2);
    
    // Verify
    expect(queue.dequeue()).toBe('high');
    expect(queue.dequeue()).toBe('medium');
    expect(queue.dequeue()).toBe('low');
  });

  test('handles same priority elements in FIFO order', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act
    queue.enqueue('first', 1);
    queue.enqueue('second', 1);
    queue.enqueue('third', 1);
    
    // Verify
    expect(queue.dequeue()).toBe('first');
    expect(queue.dequeue()).toBe('second');
    expect(queue.dequeue()).toBe('third');
  });

  test('isEmpty returns true for empty queue', () => {
    // Setup
    const queue = new PriorityQueue<number>();
    
    // Act & Verify
    expect(queue.isEmpty()).toBe(true);
  });

  test('isEmpty returns false for non-empty queue', () => {
    // Setup
    const queue = new PriorityQueue<number>();
    
    // Act
    queue.enqueue(42, 1);
    
    // Verify
    expect(queue.isEmpty()).toBe(false);
  });

  test('isEmpty returns true after all elements are dequeued', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    queue.enqueue('test', 1);
    
    // Act
    queue.dequeue();
    
    // Verify
    expect(queue.isEmpty()).toBe(true);
  });

  test('dequeue returns undefined for empty queue', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act & Verify
    expect(queue.dequeue()).toBeUndefined();
  });

  test('handles zero priority', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act
    queue.enqueue('zero', 0);
    queue.enqueue('one', 1);
    
    // Verify
    expect(queue.dequeue()).toBe('zero');
    expect(queue.dequeue()).toBe('one');
  });

  test('handles negative priorities', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act
    queue.enqueue('negative', -1);
    queue.enqueue('zero', 0);
    queue.enqueue('positive', 1);
    
    // Verify
    expect(queue.dequeue()).toBe('negative');
    expect(queue.dequeue()).toBe('zero');
    expect(queue.dequeue()).toBe('positive');
  });

  test('works with different data types', () => {
    // Setup
    interface Task {
      id: number;
      name: string;
    }
    const queue = new PriorityQueue<Task>();
    
    // Act
    queue.enqueue({ id: 1, name: 'low' }, 3);
    queue.enqueue({ id: 2, name: 'high' }, 1);
    const result = queue.dequeue();
    
    // Verify
    expect(result?.id).toBe(2);
    expect(result?.name).toBe('high');
  });

  test('handles large number of elements', () => {
    // Setup
    const queue = new PriorityQueue<number>();
    
    // Act - Add elements in reverse priority order
    for (let i = 100; i >= 1; i--) {
      queue.enqueue(i, i);
    }
    
    // Verify - Should dequeue in ascending priority order (1, 2, 3, ...)
    for (let i = 1; i <= 100; i++) {
      expect(queue.dequeue()).toBe(i);
    }
    expect(queue.isEmpty()).toBe(true);
  });

  test('mixed priority operations', () => {
    // Setup
    const queue = new PriorityQueue<string>();
    
    // Act & Verify - First operation cycle
    queue.enqueue('first', 2);
    expect(queue.dequeue()).toBe('first');
    expect(queue.isEmpty()).toBe(true);
    
    // Act & Verify - Second operation cycle
    queue.enqueue('second', 1);
    queue.enqueue('third', 3);
    expect(queue.dequeue()).toBe('second');
    expect(queue.isEmpty()).toBe(false);
    
    // Act & Verify - Third operation cycle
    queue.enqueue('fourth', 0);
    expect(queue.dequeue()).toBe('fourth');
    expect(queue.dequeue()).toBe('third');
    expect(queue.isEmpty()).toBe(true);
  });
});