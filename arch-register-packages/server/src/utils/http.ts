import { HTTPError } from 'h3';
import { DatabaseError } from '../db/database';

type DbErrorMapping = Partial<Record<DatabaseError['code'], string>>;

/**
 * Handles route errors by mapping normalized database errors to HTTP responses.
 * Re-throws existing HTTPErrors, maps known database codes to specific messages,
 * and falls back to 500 for everything else.
 */
export const handleDbError = (
  error: unknown,
  fallback: string,
  dbCodes?: DbErrorMapping
): never => {
  if (HTTPError.isError(error)) throw error;
  if (error instanceof DatabaseError) {
    const message = dbCodes?.[error.code];
    if (message) {
      const status = error.code === 'unique' || error.code === 'foreign' ? 409 : 400;
      const statusText = status === 409 ? 'Conflict' : 'Bad Request';
      throw new HTTPError({ status, statusText, message });
    }
  }
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

export const parsePositiveInt = (value: unknown, field: string) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `${field} must be a non-negative integer`
    });
  }
  return parsed;
};

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
