/**
 * Debug mode utilities for conditional debug behavior.
 *
 * Provides scoped debug mode execution for debugging-specific code paths.
 *
 * @example
 * ```ts
 * import { withDebug, isDebug } from '@diagram-craft/utils/debug';
 *
 * // Run code with debug mode enabled
 * const result = withDebug(() => {
 *   if (isDebug()) {
 *     console.log('Debug info');
 *   }
 *   return computeValue();
 * }, { logLabel: 'Computation' });
 * ```
 *
 * @module
 * @internal
 */

let debug = false;

/**
 * Executes a function with debug mode enabled, then automatically resets it.
 *
 * This function creates a scoped debug context where code can check {@link isDebug}
 * to conditionally execute debug-specific logic. The debug state is automatically
 * reset after execution, even if the function throws an error.
 *
 * @template T - The return type of the function
 * @param fn - The function to execute with debug mode enabled
 * @param opts - Optional configuration
 * @param opts.enabled - Whether to enable debug mode (default: true)
 * @param opts.logLabel - Optional label for automatic entry/exit logging
 * @returns The result of the executed function
 *
 * @example
 * ```ts
 * const result = withDebug(() => {
 *   // Debug mode is enabled here
 *   if (isDebug()) console.log('Detailed info');
 *   return calculate();
 * }, { logLabel: 'Calculate' });
 * // Debug mode is disabled here
 * ```
 *
 * @internal
 */
export const withDebug = <T>(fn: () => T, opts?: { enabled?: boolean; logLabel?: string }): T => {
  debug = opts && opts.enabled !== undefined ? opts.enabled : true;
  if (opts?.logLabel && debug) console.log(`--> DEBUG ${opts.logLabel}`);
  try {
    return fn();
  } finally {
    if (opts?.logLabel && debug) console.log(`<-- DEBUG ${opts.logLabel}`);
    debug = false;
  }
};

/**
 * Checks if debug mode is currently enabled.
 *
 * Use this function within code executed by {@link withDebug} to conditionally
 * run debug-specific logic. Outside a debug context, this always returns false.
 *
 * @returns True if currently executing within a debug context, false otherwise
 *
 * @example
 * ```ts
 * withDebug(() => {
 *   if (isDebug()) {
 *     console.log('This only logs in debug mode');
 *   }
 * });
 * ```
 *
 * @internal
 */
export const isDebug = () => debug;
