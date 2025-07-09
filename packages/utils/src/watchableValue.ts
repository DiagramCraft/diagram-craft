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
}
