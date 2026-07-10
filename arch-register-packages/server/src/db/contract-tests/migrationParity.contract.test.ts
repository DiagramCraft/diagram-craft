import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../migrations');

describe('migration parity', () => {
  it('every postgres migration has a matching sqlite migration and vice versa', () => {
    const files = readdirSync(migrationsDir);

    const postgresStems = new Set(
      files.filter(f => f.endsWith('.postgres.sql')).map(f => f.replace(/\.postgres\.sql$/, ''))
    );
    const sqliteStems = new Set(
      files.filter(f => f.endsWith('.sqlite.sql')).map(f => f.replace(/\.sqlite\.sql$/, ''))
    );

    const missingSqlite = [...postgresStems].filter(stem => !sqliteStems.has(stem)).sort();
    const missingPostgres = [...sqliteStems].filter(stem => !postgresStems.has(stem)).sort();

    expect(missingSqlite, `postgres migrations missing a sqlite counterpart`).toEqual([]);
    expect(missingPostgres, `sqlite migrations missing a postgres counterpart`).toEqual([]);
  });
});
