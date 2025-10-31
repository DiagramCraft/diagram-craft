/**
 * URL parsing and manipulation utilities.
 *
 * @example
 * ```ts
 * import { urlToName } from '@diagram-craft/utils/url';
 *
 * const name = urlToName('https://example.com/path/file.pdf');
 * // Result: 'file.pdf'
 * ```
 *
 * @module
 */

/**
 * Extracts the filename from a URL.
 *
 * @param s - The URL string
 * @returns The filename (last segment of the path)
 *
 * @example
 * ```ts
 * urlToName('https://example.com/docs/guide.pdf'); // 'guide.pdf'
 * urlToName('/local/path/image.png'); // 'image.png'
 * ```
 */
export const urlToName = (s: string) => {
  let pathname = s;
  try {
    pathname = new URL(s).pathname;
  } catch (_e) {
    // Ignore
  }
  return pathname.split('/').pop()!;
};
