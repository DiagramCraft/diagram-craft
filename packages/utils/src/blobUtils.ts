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
export const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = _e => resolve(reader.result as string);
    reader.onerror = _e => reject(reader.error === null ? new Error('Read error') : reader.error);
    reader.onabort = _e => reject(new Error('Read aborted'));
    reader.readAsDataURL(blob);
  });
