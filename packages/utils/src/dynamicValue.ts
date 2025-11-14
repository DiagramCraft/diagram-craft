/*
 * Copyright (c) 2025 Magnus Johansson
 * SPDX-License-Identifier: ISC
 */

/**
 * A wrapper class that provides dynamic evaluation of values through a callback function.
 *
 * This class is useful when you need to defer the computation or retrieval of a value
 * until it's actually needed, allowing for lazy evaluation and dynamic dependencies.
 *
 * @template T The type of value that will be returned by the callback
 *
 * @example
 * ```typescript
 * // Create a dynamic value that returns the current timestamp
 * const currentTime = new DynamicValue(() => Date.now());
 *
 * // The callback is executed each time get() is called
 * console.log(currentTime.get()); // 1699123456789
 * setTimeout(() => {
 *   console.log(currentTime.get()); // 1699123456890 (different value)
 * }, 100);
 * ```
 *
 * @example
 * ```typescript
 * // Use with complex objects that may change over time
 * const userPreferences = new DynamicValue(() => ({
 *   theme: localStorage.getItem('theme') || 'dark',
 *   language: navigator.language
 * }));
 *
 * const prefs = userPreferences.get();
 * ```
 */
export class DynamicValue<T> {
  /**
   * Creates a new DynamicValue instance with the provided callback function.
   *
   * @param callback A function that will be called each time the value is requested.
   *                 This function should return a value of type T.
   */
  constructor(private readonly callback: () => T) {}

  static of<T>(v: T) {
    return new DynamicValue(() => v);
  }

  /**
   * Executes the callback function and returns its result.
   *
   * Note that this method calls the callback function every time it's invoked,
   * so if the callback has side effects or is computationally expensive,
   * consider caching the result if appropriate.
   *
   * @returns The result of executing the callback function
   */
  get() {
    return this.callback();
  }
}
