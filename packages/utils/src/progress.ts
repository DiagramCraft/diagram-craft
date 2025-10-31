/**
 * Progress tracking types for async operations.
 *
 * @example
 * ```ts
 * import { Progress, ProgressCallback } from '@diagram-craft/utils/progress';
 *
 * const callback: ProgressCallback = (status, { message, completion }) => {
 *   console.log(`${status}: ${message} (${completion}%)`);
 * };
 *
 * callback('pending', { message: 'Loading...', completion: 50 });
 * callback('complete', { message: 'Done!' });
 * ```
 *
 * @module
 */

/**
 * Progress information for an operation.
 */
export type Progress = {
  /** Current status of the operation */
  status: 'complete' | 'error' | 'pending';
  /** Optional status message */
  message?: string;
  /** Optional completion percentage (0-100) */
  completion?: number;
};

/**
 * Callback function for receiving progress updates.
 */
export type ProgressCallback = (
  status: Progress['status'],
  opts: Pick<Progress, 'message' | 'completion'>
) => void;
