import type { SqliteMigration } from './sqliteSqlSource';

/** Browser (Vite) replacement for `sqliteSqlSource.ts`; bundles the SQL as raw strings. */

const schema = import.meta.glob('./schema.sqlite.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const migrations = import.meta.glob('./migrations/*.sqlite.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export const readSqliteSchema = (): string => Object.values(schema)[0] ?? '';

export const readSqliteMigrations = (): SqliteMigration[] =>
  Object.entries(migrations)
    .map(([path, sql]) => ({
      version: path.split('/').pop()!.replace('.sqlite.sql', ''),
      sql
    }))
    .sort((a, b) => a.version.localeCompare(b.version));
