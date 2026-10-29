import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '@arch-register/server/db/factory';
import { runPostgresMigrations } from '@arch-register/server/db/migrate';
import {
  createPostgresDatabase,
  dropPostgresDatabase,
  withDatabaseName
} from '@arch-register/server/db/testSupport/provisionDatabase';
import { seedMinimal } from './seedHelper';

export type PgTemplates = { empty: string; minimal: string };

declare module 'vitest' {
  export interface ProvidedContext {
    pgTemplates: PgTemplates | undefined;
  }
}

const schemaSql = new URL('../../../server/src/db/schema.postgres.sql', import.meta.url);

const TEMPLATE_PREFIX = 'ar_tpl_';

const dropStaleTemplates = async (adminUrl: string) => {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    const rows = await sql<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${TEMPLATE_PREFIX}%`}`;
    for (const { datname } of rows) await dropPostgresDatabase(adminUrl, datname);
  } finally {
    await sql.end();
  }
};

const migrate = async (url: string) => {
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await sql.unsafe(await readFile(schemaSql, 'utf8'));
    await runPostgresMigrations(sql);
  } finally {
    await sql.end();
  }
};

/**
 * Builds template databases once per run so each test file can clone one with
 * `CREATE DATABASE ... TEMPLATE` instead of applying all migrations itself.
 * Only active with E2E_DB_DRIVER=postgres.
 */
export default async function setup(project: TestProject) {
  if (process.env['E2E_DB_DRIVER'] !== 'postgres') {
    project.provide('pgTemplates', undefined);
    return;
  }

  const adminUrl = process.env['DATABASE_URL'];
  if (!adminUrl) throw new Error('DATABASE_URL is required when E2E_DB_DRIVER=postgres');

  const probe = postgres(adminUrl, { max: 1 });
  const hasCreateDb = await probe`
    SELECT rolcreatedb OR rolsuper AS ok FROM pg_roles WHERE rolname = current_user`
    .then(rows => rows[0]?.['ok'] === true)
    .finally(() => probe.end());
  if (!hasCreateDb) {
    throw new Error(
      'E2E_DB_DRIVER=postgres needs a role with CREATEDB (each test file gets its own database). ' +
        'Run: ALTER ROLE <user> CREATEDB;'
    );
  }

  await dropStaleTemplates(adminUrl);

  const runId = randomBytes(4).toString('hex');
  const templates: PgTemplates = {
    empty: `${TEMPLATE_PREFIX}${runId}_empty`,
    minimal: `${TEMPLATE_PREFIX}${runId}_minimal`
  };

  await createPostgresDatabase(adminUrl, templates.empty);
  await migrate(withDatabaseName(adminUrl, templates.empty));

  // Clone empty -> minimal and seed it. Connections must be closed before it can be a template.
  await createPostgresDatabase(adminUrl, templates.minimal, templates.empty);
  process.env['DB_DRIVER'] = 'postgres';
  const db = await createDatabase({
    initialize: false,
    postgresUrl: withDatabaseName(adminUrl, templates.minimal)
  });
  try {
    await seedMinimal(db);
  } finally {
    await db.core.close();
  }

  project.provide('pgTemplates', templates);

  return async () => {
    await dropPostgresDatabase(adminUrl, templates.minimal);
    await dropPostgresDatabase(adminUrl, templates.empty);
  };
}
