import { readdirSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { PostgresSqlClient } from './postgresBase.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

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
    console.log(`[migrations] Applied: ${version}`);
  }
};

export const runPostgresMigrations = async (sql: PostgresSqlClient): Promise<void> => {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    )
  `;

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
