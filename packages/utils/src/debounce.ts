/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 *
 * @template T - The type of the function to debounce
 * @param {T} fn - The function to debounce
 * @param {number} ms - The number of milliseconds to delay (default: 0)
 * @returns {T} A debounced version of the function
 *
 * @example
 * // Create a debounced version of a function
 * const debouncedFn = debounce(() => console.log('Debounced'), 300);
 *
 * // Call it multiple times - only the last call will execute after 300ms
 * debouncedFn();
 * debouncedFn();
 * debouncedFn(); // Only this call will result in execution
 */
// biome-ignore lint/suspicious/noExplicitAny: false positive
export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 0): T {
  let timeoutId: ReturnType<typeof setTimeout>;

  // Using function() instead of arrow function to preserve 'this' context
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    // TODO: This function should always return void
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  } as T;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until the next microtask queue. This is useful for batching operations
 * that need to happen in the same event loop but after the current execution.
 *
 * @template T - The type of the function to debounce
 * @param {T} fn - The function to debounce
 * @returns {T} A microtask-debounced version of the function
 *
 * @example
 * // Create a microtask-debounced version of a function
 * const debouncedFn = debounceMicrotask(() => console.log('Microtask debounced'));
 *
 * // Call it multiple times in the same event loop - only executes once
 * debouncedFn();
 * debouncedFn();
 * debouncedFn(); // Only one execution will happen in the next microtask
 */
// biome-ignore lint/suspicious/noExplicitAny: false positive
export function debounceMicrotask<T extends (...args: any[]) => any>(fn: T): T {
  let queued = false;

  // Using function() instead of arrow function to preserve 'this' context
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    if (queued) return;
    queued = true;

    queueMicrotask(() => {
      try {
        fn.apply(this, args);
      } finally {
        queued = false;
      }
    });
  } as T;
}
