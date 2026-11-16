import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Source of the SQLite schema and migrations. This file reads from disk; the browser demo build
 * aliases it to `sqliteSqlSource.browser.ts`, which bundles the SQL via Vite `?raw` imports.
 */

export type SqliteMigration = { version: string; sql: string };

const dbDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(dbDir, 'migrations');

export const readSqliteSchema = (): string =>
  readFileSync(join(dbDir, 'schema.sqlite.sql'), 'utf8');

export const readSqliteMigrations = (): SqliteMigration[] => {
  let files: string[];
  try {
    files = readdirSync(migrationsDir);
  } catch {
    return [];
  }

  return files
    .filter(f => f.endsWith('.sqlite.sql'))
    .sort()
    .map(f => ({
      version: f.replace('.sqlite.sql', ''),
      sql: readFileSync(join(migrationsDir, f), 'utf8')
    }));
};
