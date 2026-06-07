import { readdirSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { PostgresSqlClient } from './postgresBase';
import { createLogger } from '@arch-register/server/utils/logger';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Parses migration file content to extract table names from @creates comments.
 * Format: -- @creates table_name
 */
const extractCreatedTables = (content: string): string[] => {
  const tables: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^--\s*@creates\s+(\w+)/);
    if (match?.[1]) {
      tables.push(match[1]);
    }
  }

  return tables;
};

/**
 * Gets all tables created by migrations in reverse order (newest first).
 * This allows proper cleanup during database reset.
 */
export const getMigrationTables = async (driver: 'postgres' | 'sqlite'): Promise<string[]> => {
  const extension = driver === 'postgres' ? '.postgres.sql' : '.sqlite.sql';

  let files: string[];
  try {
    files = await readdir(migrationsDir);
  } catch {
    return [];
  }

  const migrationFiles = files
    .filter(f => f.endsWith(extension))
    .sort()
    .reverse(); // Reverse order for proper cleanup

  const allTables: string[] = [];

  for (const file of migrationFiles) {
    const content = await readFile(join(migrationsDir, file), 'utf8');
    const tables = extractCreatedTables(content);
    allTables.push(...tables);
  }

  return allTables;
};

/**
 * Synchronous version for SQLite
 */
export const getMigrationTablesSync = (driver: 'postgres' | 'sqlite'): string[] => {
  const extension = driver === 'postgres' ? '.postgres.sql' : '.sqlite.sql';

  let files: string[];
  try {
    files = readdirSync(migrationsDir);
  } catch {
    return [];
  }

  const migrationFiles = files
    .filter(f => f.endsWith(extension))
    .sort()
    .reverse(); // Reverse order for proper cleanup

  const allTables: string[] = [];

  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsDir, file), 'utf8');
    const tables = extractCreatedTables(content);
    allTables.push(...tables);
  }

  return allTables;
};

const migrationLogger = createLogger('migrations');

export const runSqliteMigrations = (db: SqliteDatabase): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      r => r.version
    )
  );

  let files: string[];
  try {
    files = readdirSync(migrationsDir);
  } catch {
    return;
  }

  const pending = files
    .filter(f => f.endsWith('.sqlite.sql'))
    .sort()
    .filter(f => !applied.has(f.replace('.sqlite.sql', '')));

  for (const file of pending) {
    const version = file.replace('.sqlite.sql', '');
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        new Date().toISOString()
      );
    })();
    migrationLogger.info(`Applied: ${version}`);
  }
};

export const runPostgresMigrations = async (sql: PostgresSqlClient): Promise<void> => {
  const migrationTableExists = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'schema_migrations'
    ) AS exists
  `;

  if (!migrationTableExists[0]?.exists) {
    await sql`
      CREATE TABLE schema_migrations (
        version    TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `;
  }

  const rows = await sql<{ version: string }[]>`SELECT version FROM schema_migrations`;
  const applied = new Set(rows.map(r => r.version));

  let files: string[];
  try {
    files = await readdir(migrationsDir);
  } catch {
    return;
  }

  const pending = files
    .filter(f => f.endsWith('.postgres.sql'))
    .sort()
    .filter(f => !applied.has(f.replace('.postgres.sql', '')));

  for (const file of pending) {
    const version = file.replace('.postgres.sql', '');
    const migrationSql = await readFile(join(migrationsDir, file), 'utf8');
    await sql.begin(async t => {
      await t.unsafe(migrationSql);
      await t`INSERT INTO schema_migrations (version, applied_at) VALUES (${version}, NOW())`;
    });
    console.log(`[migrations] Applied: ${version}`);
  }
};
