/**
 * Generator utility functions.
 *
 * @example
 * ```ts
 * import { Generators } from '@diagram-craft/utils/generator';
 *
 * function* numbers() {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * }
 *
 * const first = Generators.first(numbers()); // 1
 * ```
 *
 * @module
 */

/** @namespace */
export const Generators = {
  /**
   * Retrieves the first value from a generator.
   *
   * @param g - The generator to get the first value from
   * @returns The first yielded value, or undefined if the generator is empty
   */
  first: <T>(g: Generator<T>): T | undefined => {
    return g.next().value;
  }
};
