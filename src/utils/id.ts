/**
 * Generates a new unique identifier.
 *
 * @returns A string containing the generated identifier.
 *
 * @example
 * // returns a string of 7 random alphanumeric characters
 * newid();
 */
export const newid = () => {
  return Math.random().toString(36).substring(2, 9);
};
