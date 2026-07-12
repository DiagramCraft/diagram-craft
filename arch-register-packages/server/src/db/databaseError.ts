export type NormalizedDbErrorCode =
  | 'unique'
  | 'foreign'
  | 'check'
  | 'notnull'
  | 'deadlock'
  | 'timeout'
  | 'connection'
  | 'serialization'
  | 'disk_full'
  | 'unknown';

export class DatabaseError extends Error {
  constructor(
    readonly code: NormalizedDbErrorCode,
    message: string,
    readonly cause?: unknown,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
