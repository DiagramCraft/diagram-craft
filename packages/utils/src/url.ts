/**
 * Get the name of the file from the URL
 *
 * @param s - The URL
 * @returns The name of the file
 */
export const urlToName = (s: string) => {
  let pathname = s;
  try {
    pathname = new URL(s).pathname;
  } catch (e) {
    // Ignore
  }
  return pathname.split('/').pop()!;
};
