/**
 * Simple in-memory metrics tracking.
 *
 * @example
 * ```ts
 * import { Metrics } from '@diagram-craft/utils/metrics';
 *
 * Metrics.counter('requests'); // Increment by 1
 * Metrics.counter('requests', 5); // Increment by 5
 * Metrics.gauge('memory', 1024); // Set to specific value
 * ```
 *
 * @module
 */

const metrics = new Map<string, number>();

/** @namespace */
export const Metrics = {
  /**
   * Increments a counter metric by the specified amount.
   *
   * @param name - The name of the counter metric
   * @param n - The amount to increment (default: 1)
   *
   * @example
   * ```ts
   * Metrics.counter('api.calls'); // Increment by 1
   * Metrics.counter('api.calls', 10); // Increment by 10
   * ```
   */
  counter(name: string, n = 1) {
    const v = metrics.get(name) ?? 0;
    metrics.set(name, v + n);
  },

  /**
   * Sets a gauge metric to a specific value.
   *
   * @param name - The name of the gauge metric
   * @param n - The value to set
   *
   * @example
   * ```ts
   * Metrics.gauge('cpu.usage', 75);
   * Metrics.gauge('memory.mb', 2048);
   * ```
   */
  gauge(name: string, n: number) {
    metrics.set(name, n);
  }
};

// setInterval(() => console.log(metrics));
