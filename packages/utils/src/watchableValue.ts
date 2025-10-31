/**
 * Observable value container with change notifications.
 *
 * @example
 * ```ts
 * import { WatchableValue, watch } from '@diagram-craft/utils/watchableValue';
 *
 * const count = new WatchableValue(0);
 *
 * // Watch for changes
 * count.on('change', ({ newValue }) => {
 *   console.log('Count changed to:', newValue);
 * });
 *
 * count.set(5); // Logs: "Count changed to: 5"
 * count.get(); // 5
 *
 * // Computed values
 * const doubled = WatchableValue.from(([c]) => c.get() * 2, [count]);
 * ```
 *
 * @module
 */

import { EventEmitter } from './event';

/**
 * A value container that emits events when its value changes.
 * Extends EventEmitter to provide change notifications when the value is updated.
 * @template T The type of value being watched
 */
export class WatchableValue<T> extends EventEmitter<{
  change: { newValue: T };
}> {
  #value: T;

  /**
   * Creates a new WatchableValue instance
   * @param value - The initial value to store
   */
  constructor(value: T) {
    super();
    this.#value = value;
  }

  /**
   * Returns the current value
   * @returns The stored value
   */
  get() {
    return this.#value;
  }

  /**
   * Updates the stored value and emits a change event if the value is different
   * @param value - The new value to store
   */
  set(value: T) {
    if (this.#value !== value) {
      this.#value = value;
      this.emit('change', { newValue: value });
    }
  }

  /**
   * Creates a new instance of `WatchableValue` based on the provided function and array of `WatchableValue` arguments.
   * The resulting value updates whenever any of the input `WatchableValue` instances change.
   *
   * @param fn - A function that computes a new value based on the array of `WatchableValue` instances.
   * @param arg - An array of `WatchableValue` instances that the result depends on.
   * @return A new `WatchableValue` instance that tracks the computed result of the function.
   */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  static from<T, K extends [WatchableValue<any>, ...WatchableValue<any>[]]>(
    fn: (arg: K) => T,
    arg: K
  ) {
    const v = new WatchableValue(fn(arg));

    for (const wv of arg) {
      wv.on('change', () => v.set(fn(arg)));
    }

    return v;
  }
}

/**
 * Convenience function to create a new WatchableValue.
 *
 * @template T - The type of value to watch
 * @param value - The initial value
 * @returns A new WatchableValue instance
 *
 * @example
 * ```ts
 * const name = watch('Alice');
 * name.on('change', ({ newValue }) => console.log(newValue));
 * name.set('Bob'); // Logs: "Bob"
 * ```
 */
export const watch = <T>(value: T) => new WatchableValue<T>(value);
