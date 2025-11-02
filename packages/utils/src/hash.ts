/**
 * Fast non-cryptographic hash functions for byte arrays.
 *
 * @example
 * ```ts
 * import { hash, hash64 } from '@diagram-craft/utils/hash';
 *
 * const data = new TextEncoder().encode('Hello, World!');
 * const numericHash = hash(data);
 * const stringHash = hash64(data);
 * ```
 *
 * @module
 */

/**
 * Generates a 64-bit hash as a hexadecimal string.
 *
 * @param arr - The byte array to hash
 * @param seed - Optional seed value for hash initialization (default: 0)
 * @returns 16-character hexadecimal hash string
 *
 * @see https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 */
export const hash64 = (arr: Uint8Array, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  let ch: number = 0;

  for (let i = 0; i < arr.byteLength; i++) {
    ch = arr[i]!;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

/**
 * Generates a 32-bit hash as a number.
 *
 * @param arr - The byte array to hash
 * @returns 32-bit unsigned integer hash value
 *
 * @see https://gist.github.com/eplawless/52813b1d8ad9af510d85
 */
export const hash = (arr: Uint8Array): number => {
  let res = 5381;
  for (let i = 0; i < arr.length; i++) {
    res = (res * 33) ^ arr[i]!;
  }
  return res >>> 0;
};
