/**
 * Type-safe event emitter implementation with priority-based event handling.
 *
 * Provides a strongly-typed event system with support for synchronous, asynchronous,
 * and debounced event emission. Listeners can be registered with priorities to control
 * execution order.
 *
 * @example
 * ```ts
 * import { EventEmitter } from '@diagram-craft/utils/event';
 *
 * type Events = {
 *   userLogin: { userId: string };
 *   dataChanged: { field: string; value: unknown };
 * };
 *
 * const emitter = new EventEmitter<Events>();
 *
 * emitter.on('userLogin', ({ userId }) => {
 *   console.log('User logged in:', userId);
 * }, { priority: 10 });
 *
 * emitter.emit('userLogin', { userId: '123' });
 * ```
 *
 * @module
 */

import { debounceMicrotask } from './debounce';
import { newid } from './id';

/**
 * Maps event names to their parameter types.
 */
export type EventMap = Record<string, unknown>;

/**
 * Extracts valid event keys from an EventMap.
 */
export type EventKey<T> = string & keyof T;

/**
 * Function signature for event receivers.
 */
export type EventReceiver<T> = (params: T) => void;

/**
 * Options for event subscription.
 */
export type EventSubscriptionOpts = {
  /** Unique identifier for this subscription (auto-generated if not provided) */
  id?: string;
  /** Priority for event handler execution (higher priority runs first, default: 0) */
  priority?: number;
};

/**
 * Interface for objects that can emit events.
 */
export interface Emitter<T extends EventMap> {
  /**
   * Registers an event listener.
   *
   * @param eventName - The name of the event to listen for
   * @param fn - The callback function to execute when the event is emitted
   * @param opts - Optional subscription options (id, priority)
   */
  on<K extends EventKey<T>>(
    eventName: K,
    fn: EventReceiver<T[K]>,
    opts?: EventSubscriptionOpts
  ): void;

  /**
   * Unregisters an event listener.
   *
   * @param eventName - The name of the event
   * @param fnOrId - The callback function or subscription ID to remove
   */
  off<K extends EventKey<T>>(eventName: K, fnOrId: EventReceiver<T[K]> | string): void;
}

/**
 * Type-safe event emitter with support for sync, async, and debounced event emission.
 *
 * Listeners are executed in priority order (highest priority first). Each listener
 * is automatically wrapped in debounced and async variants for flexible event handling.
 *
 * @template T - The event map defining event names and their parameter types
 *
 * @example
 * ```ts
 * type MyEvents = {
 *   save: { id: string };
 *   delete: { id: string };
 * };
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('save', ({ id }) => console.log('Saved:', id));
 * emitter.emit('save', { id: '123' });
 * ```
 */
export class EventEmitter<T extends EventMap> implements Emitter<T> {
  protected listeners: {
    [K in keyof T]?: Array<{
      id: string;
      fn: EventReceiver<T[K]>;
      fnDebounce: EventReceiver<T[K]>;
      fnAsync: EventReceiver<T[K]>;
      priority: number;
    }>;
  } = {};

  /**
   * Registers an event listener.
   *
   * Listeners are automatically sorted by priority (highest first) when registered.
   *
   * @param eventName - The event to listen for
   * @param fn - The callback function
   * @param opts - Optional configuration (id, priority)
   *
   * @example
   * ```ts
   * emitter.on('save', ({ id }) => {
   *   console.log('Saving:', id);
   * }, { priority: 10 });
   * ```
   */
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>, opts?: EventSubscriptionOpts) {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push({
      id: opts?.id ?? newid(),
      fn: fn,
      fnDebounce: debounceMicrotask(fn),
      fnAsync: e => queueMicrotask(() => fn(e)),
      priority: opts?.priority ?? 0
    });
    this.listeners[eventName].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Unregisters an event listener by function reference or subscription ID.
   *
   * @param eventName - The event name
   * @param fnOrId - The callback function or subscription ID to remove
   *
   * @example
   * ```ts
   * const handler = ({ id }) => console.log(id);
   * emitter.on('save', handler);
   * emitter.off('save', handler);
   * ```
   */
  off<K extends EventKey<T>>(eventName: K, fnOrId: EventReceiver<T[K]> | string) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(l => {
      if (fnOrId instanceof Function) {
        return l.fn !== fnOrId;
      } else {
        return l.id !== fnOrId;
      }
    });
  }

  /**
   * Emits an event asynchronously with debouncing.
   *
   * Multiple calls within the same microtask are collapsed into a single execution.
   *
   * @param eventName - The event to emit
   * @param params - The event parameters
   * @internal
   */
  protected emitAsyncWithDebounce<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fnDebounce({ ...(params ?? {}) } as T[K]);
    });
  }

  /**
   * Emits an event asynchronously (on the next microtask).
   *
   * Listeners are called asynchronously, allowing the current execution to complete first.
   *
   * @param eventName - The event to emit
   * @param params - The event parameters
   *
   * @example
   * ```ts
   * emitter.emitAsync('save', { id: '123' });
   * console.log('This runs before listeners');
   * ```
   */
  emitAsync<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fnAsync({ ...(params ?? {}) } as T[K]);
    });
  }

  /**
   * Emits an event synchronously.
   *
   * All registered listeners are called immediately in priority order.
   *
   * @param eventName - The event to emit
   * @param params - The event parameters
   *
   * @example
   * ```ts
   * emitter.emit('save', { id: '123' });
   * console.log('This runs after all listeners');
   * ```
   */
  emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fn({ ...(params ?? {}) } as T[K]);
    });
  }

  protected clearListeners() {
    this.listeners = {};
  }
}
