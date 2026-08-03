import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';
import { runPostgresMigrations } from '../migrate';

const postgresSchemaSql = new URL('../schema.postgres.sql', import.meta.url);

/**
 * Recreates an application-owned PostgreSQL schema for bootstrap and tests.
 *
 * This function is intentionally outside the runtime database adapter. The
 * caller must explicitly opt into destructive setup before invoking it.
 */
export const recreatePostgresSchema = async (
  connectionString: string,
  schema = 'public'
): Promise<void> => {
  if (schema.trim().length === 0) throw new Error('PostgreSQL schema must not be empty');

  const sql = postgres(connectionString, { max: 1, onnotice: () => undefined });
  try {
    await sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`;
    await sql`CREATE SCHEMA ${sql(schema)}`;
    await sql`SET search_path TO ${sql(schema)}`;
    await sql.unsafe(await readFile(postgresSchemaSql, 'utf8'));
    await runPostgresMigrations(sql);
  } finally {
    await sql.end();
  }
};

/** Removes a SQLite database file before a fresh adapter is created. */
export const recreateSqliteDatabase = async (filePath: string): Promise<void> => {
  const resolvedPath = resolve(filePath);
  await rm(resolvedPath, { force: true });
  await rm(`${resolvedPath}-wal`, { force: true });
  await rm(`${resolvedPath}-shm`, { force: true });
  await mkdir(dirname(resolvedPath), { recursive: true });
};
