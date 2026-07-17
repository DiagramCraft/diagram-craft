import { DatabaseError } from './databaseError';

export type DatabaseRow = Record<string, unknown>;
export type DatabaseRowMapper<T> = (row: DatabaseRow) => T;

/**
 * Database JSON columns are returned as strings by SQLite and as decoded
 * values by postgres.js. Keeping this conversion in one place lets domain
 * mappers be shared by both drivers.
 */
export const parseDatabaseJson = <T>(value: unknown, fallback: T, field: string): T => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new DatabaseError('unknown', `Invalid JSON in database column "${field}"`, error);
  }
};

export const databaseDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(String(value));

/**
 * DATE columns are returned as plain "YYYY-MM-DD" strings by SQLite but as JS `Date` objects
 * (UTC midnight) by postgres.js. Naively calling `String()` on a `Date` produces its localized
 * `toString()` form, not an ISO date — this normalizes both drivers to "YYYY-MM-DD".
 */
export const databaseDateOnly = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export const databaseBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === '1';

export const mapDatabaseRows = <T>(rows: DatabaseRow[], mapper: DatabaseRowMapper<T>): T[] =>
  rows.map(mapper);

export const mapDatabaseRow = <T>(row: DatabaseRow | undefined, mapper: DatabaseRowMapper<T>) =>
  row ? mapper(row) : null;
