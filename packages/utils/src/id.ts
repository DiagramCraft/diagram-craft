/**
 * Unique identifier generation.
 *
 * @example
 * ```ts
 * import { newid } from '@diagram-craft/utils/id';
 *
 * const id = newid(); // e.g., 'a7b2c3d'
 * ```
 *
 * @module
 */

/**
 * Generates a new unique identifier.
 *
 * Creates a 7-character alphanumeric string using Math.random().
 * Suitable for non-cryptographic uses like UI element IDs.
 *
 * @returns A 7-character random alphanumeric string
 *
 * @example
 * ```ts
 * const id = newid(); // e.g., 'x9k2m4p'
 * ```
 */
export const newid = () => {
  return Math.random().toString(36).substring(2, 9);
};
