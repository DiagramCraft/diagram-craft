/**
 * Seeded pseudo-random number generator.
 *
 * @example
 * ```ts
 * import { Random } from '@diagram-craft/utils/random';
 *
 * const rng = new Random(12345); // Deterministic with seed
 *
 * const value = rng.nextFloat(); // 0.0 to 1.0
 * const inRange = rng.nextRange(10, 20); // 10 to 20
 * const coin = rng.nextBoolean(); // true or false
 * const item = rng.pick(['a', 'b', 'c']); // Random element
 * ```
 *
 * @module
 */

/**
 * Seeded pseudo-random number generator for reproducible randomness.
 *
 * Uses a simple hash-based PRNG algorithm. Useful for testing, procedural
 * generation, or any scenario requiring deterministic randomness.
 *
 * @example
 * ```ts
 * const rng1 = new Random(42);
 * const rng2 = new Random(42);
 * rng1.nextFloat() === rng2.nextFloat(); // true (same seed)
 * ```
 */
export class Random {
  #state: number;

  /**
   * Creates a new seeded random number generator.
   *
   * @param seed - Optional seed value. If not provided, uses current timestamp
   */
  constructor(seed?: number) {
    this.#state = (seed !== undefined ? seed : Date.now()) + 0x6d2b79f5;
  }

  /**
   * Generates the next random value.
   *
   * @returns A random number between 0 and 1
   * @see https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
   * @private
   */
  private next() {
    let t = (this.#state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Randomly picks an element from an array.
   *
   * @template T - The type of array elements
   * @param arr - The array to pick from
   * @returns A random element from the array
   *
   * @example
   * ```ts
   * const colors = ['red', 'green', 'blue'];
   * const color = rng.pick(colors); // 'green'
   * ```
   */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /**
   * Generates a random float between 0 and 1.
   *
   * @returns A random number in the range [0, 1)
   *
   * @example
   * ```ts
   * const value = rng.nextFloat(); // 0.742...
   * ```
   */
  nextFloat() {
    return this.next();
  }

  /**
   * Generates a random number within a specified range.
   *
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (exclusive)
   * @returns A random number in the range [min, max)
   *
   * @example
   * ```ts
   * const age = rng.nextRange(18, 65); // 42.7...
   * ```
   */
  nextRange(min: number, max: number) {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Generates a random boolean value.
   *
   * @returns true or false with equal probability
   *
   * @example
   * ```ts
   * const coinFlip = rng.nextBoolean(); // true or false
   * ```
   */
  nextBoolean() {
    return this.next() > 0.5;
  }
}
