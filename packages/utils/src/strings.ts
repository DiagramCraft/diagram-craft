/**
 * Shortens a string to a specified length and appends '...' if the string is longer than the specified length.
 *
 * @param {string} str - The string to be shortened.
 * @param {number} length - The maximum length of the shortened string.
 * @returns {string} The shortened string, or the original string if it's shorter than the specified length.
 */
export const shorten = (str: string, length: number) => {
  if (length < 0) return str;
  if (str.length <= length) return str;

  return str.substring(0, length) + '...';
};
