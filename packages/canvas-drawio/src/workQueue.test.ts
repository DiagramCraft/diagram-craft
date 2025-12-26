import { describe, expect, test } from 'vitest';
import { WorkQueue } from './workQueue';

describe('WorkQueue', () => {
  test('initializes with empty queues', () => {
    const queue = new WorkQueue();
    expect(queue.queue[0]).toEqual([]);
    expect(queue.queue[1]).toEqual([]);
  });

  test('adds work with default priority 0', () => {
    const queue = new WorkQueue();
    const work = () => {};
    queue.add(work);
    expect(queue.queue[0]).toHaveLength(1);
    expect(queue.queue[0][0]).toBe(work);
    expect(queue.queue[1]).toHaveLength(0);
  });

  test('adds work with explicit priority 0', () => {
    const queue = new WorkQueue();
    const work = () => {};
    queue.add(work, 0);
    expect(queue.queue[0]).toHaveLength(1);
    expect(queue.queue[0][0]).toBe(work);
    expect(queue.queue[1]).toHaveLength(0);
  });

  test('adds work with priority 1', () => {
    const queue = new WorkQueue();
    const work = () => {};
    queue.add(work, 1);
    expect(queue.queue[0]).toHaveLength(0);
    expect(queue.queue[1]).toHaveLength(1);
    expect(queue.queue[1][0]).toBe(work);
  });

  test('adds multiple work items to same priority', () => {
    const queue = new WorkQueue();
    const work1 = () => {};
    const work2 = () => {};
    const work3 = () => {};
    queue.add(work1, 0);
    queue.add(work2, 0);
    queue.add(work3, 0);
    expect(queue.queue[0]).toHaveLength(3);
    expect(queue.queue[0]).toEqual([work1, work2, work3]);
  });

  test('adds work to both priority levels', () => {
    const queue = new WorkQueue();
    const work0a = () => {};
    const work0b = () => {};
    const work1a = () => {};
    const work1b = () => {};
    queue.add(work0a, 0);
    queue.add(work1a, 1);
    queue.add(work0b, 0);
    queue.add(work1b, 1);
    expect(queue.queue[0]).toEqual([work0a, work0b]);
    expect(queue.queue[1]).toEqual([work1a, work1b]);
  });

  test('runs empty queue without errors', () => {
    const queue = new WorkQueue();
    expect(() => queue.run()).not.toThrow();
  });

  test('executes work items when run', () => {
    const queue = new WorkQueue();
    const results: number[] = [];
    queue.add(() => results.push(1));
    queue.add(() => results.push(2));
    queue.run();
    expect(results).toEqual([1, 2]);
  });

  test('executes priority 0 before priority 1', () => {
    const queue = new WorkQueue();
    const results: string[] = [];
    queue.add(() => results.push('p0-1'), 0);
    queue.add(() => results.push('p1-1'), 1);
    queue.add(() => results.push('p0-2'), 0);
    queue.add(() => results.push('p1-2'), 1);
    queue.run();
    expect(results).toEqual(['p0-1', 'p0-2', 'p1-1', 'p1-2']);
  });

  test('executes work in order within same priority', () => {
    const queue = new WorkQueue();
    const results: number[] = [];
    queue.add(() => results.push(1), 0);
    queue.add(() => results.push(2), 0);
    queue.add(() => results.push(3), 0);
    queue.run();
    expect(results).toEqual([1, 2, 3]);
  });

  test('executes only priority 0 work when priority 1 is empty', () => {
    const queue = new WorkQueue();
    const results: string[] = [];
    queue.add(() => results.push('a'), 0);
    queue.add(() => results.push('b'), 0);
    queue.run();
    expect(results).toEqual(['a', 'b']);
  });

  test('executes only priority 1 work when priority 0 is empty', () => {
    const queue = new WorkQueue();
    const results: string[] = [];
    queue.add(() => results.push('a'), 1);
    queue.add(() => results.push('b'), 1);
    queue.run();
    expect(results).toEqual(['a', 'b']);
  });

  test('does not clear queue after running', () => {
    const queue = new WorkQueue();
    const work = () => {};
    queue.add(work, 0);
    queue.run();
    expect(queue.queue[0]).toHaveLength(1);
  });

  test('executes work multiple times if run multiple times', () => {
    const queue = new WorkQueue();
    let count = 0;
    queue.add(() => count++);
    queue.run();
    queue.run();
    expect(count).toBe(2);
  });

  test('handles work that modifies external state', () => {
    const queue = new WorkQueue();
    const state = { value: 0 };
    queue.add(() => (state.value += 10), 0);
    queue.add(() => (state.value *= 2), 1);
    queue.run();
    expect(state.value).toBe(20);
  });

  test('handles work that throws errors', () => {
    const queue = new WorkQueue();
    const results: string[] = [];
    queue.add(() => results.push('before'));
    queue.add(() => {
      throw new Error('test error');
    });
    queue.add(() => results.push('after'));
    expect(() => queue.run()).toThrow('test error');
    expect(results).toEqual(['before']);
  });

  test('handles mixed default and explicit priority assignments', () => {
    const queue = new WorkQueue();
    const results: string[] = [];
    queue.add(() => results.push('default')); // priority 0
    queue.add(() => results.push('explicit-1'), 1);
    queue.add(() => results.push('explicit-0'), 0);
    queue.run();
    expect(results).toEqual(['default', 'explicit-0', 'explicit-1']);
  });
});
