import { describe, expect, test, vi } from 'vitest';
import { EventEmitter } from './event';

type TestEvents = {
  save: { id: string };
  delete: { id: string };
  update: { value: number };
};

describe('EventEmitter', () => {
  test('should register and emit events', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('save', handler);
    emitter.emit('save', { id: '123' });

    expect(handler).toHaveBeenCalledWith({ id: '123' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should unregister events using off with function', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('save', handler);
    emitter.off('save', handler);
    emitter.emit('save', { id: '123' });

    expect(handler).not.toHaveBeenCalled();
  });

  test('should unregister events using unsubscribe function', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    const unsubscribe = emitter.on('save', handler);
    unsubscribe();
    emitter.emit('save', { id: '123' });

    expect(handler).not.toHaveBeenCalled();
  });

  test('should unregister events using off with id', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('save', handler, { id: 'test-id' });
    emitter.off('save', 'test-id');
    emitter.emit('save', { id: '123' });

    expect(handler).not.toHaveBeenCalled();
  });

  test('should execute listeners in priority order', () => {
    const emitter = new EventEmitter<TestEvents>();
    const order: number[] = [];

    emitter.on('save', () => order.push(1), { priority: 1 });
    emitter.on('save', () => order.push(3), { priority: 3 });
    emitter.on('save', () => order.push(2), { priority: 2 });

    emitter.emit('save', { id: '123' });

    expect(order).toEqual([3, 2, 1]);
  });

  test('should handle multiple listeners for same event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('save', handler1);
    emitter.on('save', handler2);
    emitter.emit('save', { id: '123' });

    expect(handler1).toHaveBeenCalledWith({ id: '123' });
    expect(handler2).toHaveBeenCalledWith({ id: '123' });
  });

  test('should handle emitAsync', async () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('save', handler);
    emitter.emitAsync('save', { id: '123' });

    expect(handler).not.toHaveBeenCalled();

    // @ts-ignore
    await new Promise(resolve => queueMicrotask(resolve));
    expect(handler).toHaveBeenCalledWith({ id: '123' });
  });
});
