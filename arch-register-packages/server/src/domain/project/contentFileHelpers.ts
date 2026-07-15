/**
 * Shared helpers for project and entity content file/folder path operations.
 */

/** Extracts the filename (basename) from a slash-separated path. */
export const fileNameFromPath = (filePath: string): string =>
  filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;

/** Returns whether a path uses one of the Markdown document extensions. */
export const isMarkdownPath = (filePath: string): boolean => {
  const lowerPath = filePath.toLowerCase();
  return lowerPath.endsWith('.md') || lowerPath.endsWith('.mdx');
};

/** Strips a Markdown document extension from a filename if present. */
export const stripMarkdownExtension = (fileName: string): string => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.mdx')) return fileName.slice(0, -4);
  if (lowerName.endsWith('.md')) return fileName.slice(0, -3);
  return fileName;
};

/** Strips the .json extension from a filename if present. */
export const stripJsonExtension = (fileName: string): string =>
  fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName;

/**
 * Derives a human-readable display name for a content node.
 * Prefers the `name` field from the body, then falls back to the filename without extension.
 */
export const displayNameFromBody = (body: Record<string, unknown>, filePath: string): string => {
  const fileName = fileNameFromPath(filePath);
  return String(body['name'] ?? stripJsonExtension(fileName));
};

/** Extracts the parent folder path from a slash-separated path, or empty string if at root. */
export const folderFromPath = (filePath: string): string =>
  filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
