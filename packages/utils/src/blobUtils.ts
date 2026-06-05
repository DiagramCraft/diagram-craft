/**
 * Utilities for working with Blob objects.
 *
 * @example
 * ```ts
 * import { blobToDataURL } from '@diagram-craft/utils/blobUtils';
 *
 * const blob = new Blob(['Hello'], { type: 'text/plain' });
 * const dataURL = await blobToDataURL(blob);
 * // dataURL: 'data:text/plain;base64,SGVsbG8='
 * ```
 *
 * @module
 */

/**
 * Converts a Blob to a Data URL string.
 *
 * Uses FileReader to read the blob and returns a base64-encoded data URL that can
 * be used directly in image src attributes or other contexts requiring inline data.
 *
 * @param blob - The Blob to convert
 * @returns Promise that resolves to the data URL string
 * @throws Error if the read operation fails or is aborted
 *
 * @example
 * ```ts
 * const imageBlob = new Blob([imageData], { type: 'image/png' });
 * const dataURL = await blobToDataURL(imageBlob);
 * img.src = dataURL;
 * ```
 */
const base64Encode = (bytes: Uint8Array) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('No base64 encoder available');
};

export const blobToDataURL = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = blob.type || 'application/octet-stream';
  return `data:${mimeType};base64,${base64Encode(bytes)}`;
};
