import { HTTPError } from 'h3';
import sql from '../db/client.js';

export type PostgresError = { code: string };

type PgErrorMapping = Record<string, string>;

/**
 * Handles route errors by mapping Postgres error codes to HTTP responses.
 * Re-throws existing HTTPErrors, maps known Postgres codes to specific messages,
 * and falls back to 500 for everything else.
 */
export const handlePgError = (error: unknown, fallback: string, pgCodes?: PgErrorMapping): never => {
  if (HTTPError.isError(error)) throw error;
  if (pgCodes && error != null && typeof error === 'object' && 'code' in error) {
    const { code } = error as PostgresError;
    const message = pgCodes[code];
    if (message) {
      const status = code === '23505' ? 409 : code === '23503' ? 409 : 400;
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
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Cast unknown body values to the postgres json type. */
export const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);
