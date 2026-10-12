import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import type { DatabaseAdapter, DbDriver } from '../database';
import { createDatabase } from '../factory';
import { recreatePostgresSchema } from '../maintenance/recreateDatabase';

export type ProvisionedDatabase = {
  driver: DbDriver;
  db: DatabaseAdapter;
  teardown: () => Promise<void>;
};

export const provisionSqliteDatabase = async (): Promise<ProvisionedDatabase> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'ar-db-test-'));
  const dbPath = join(tmpDir, 'test.sqlite');

  process.env['DB_DRIVER'] = 'sqlite';
  process.env['SQLITE_PATH'] = dbPath;

  const db = await createDatabase();

  return {
    driver: 'sqlite',
    db,
    teardown: async () => {
      await db.core.close();
      await rm(tmpDir, { recursive: true, force: true });
    }
  };
};

/** Returns `url` with its database name replaced by `name`. */
export const withDatabaseName = (url: string, name: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
};

const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Creates an empty database (no schema applied) using the server in `adminUrl`. */
export const createPostgresDatabase = async (
  adminUrl: string,
  name: string,
  template?: string
): Promise<void> => {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    await sql.unsafe(
      `CREATE DATABASE ${quoteIdent(name)}${template ? ` TEMPLATE ${quoteIdent(template)}` : ''}`
    );
  } finally {
    await sql.end();
  }
};

export const dropPostgresDatabase = async (adminUrl: string, name: string): Promise<void> => {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
  } finally {
    await sql.end();
  }
};

type ProvisionPostgresOptions = {
  /**
   * Name of a template database (same server as DATABASE_URL) to clone. When set, a
   * dedicated database is created from it instead of a schema being built from scratch.
   */
  template?: string;
};

export const provisionPostgresDatabase = async (
  options: ProvisionPostgresOptions = {}
): Promise<ProvisionedDatabase> => {
  const baseUrl = process.env['DATABASE_URL'];
  if (!baseUrl) throw new Error('DATABASE_URL is required to provision a postgres database');

  process.env['DB_DRIVER'] = 'postgres';

  if (options.template) {
    const name = `db_test_${randomBytes(8).toString('hex')}`;
    await createPostgresDatabase(baseUrl, name, options.template);

    const db = await createDatabase({
      initialize: false,
      postgresUrl: withDatabaseName(baseUrl, name)
    });

    return {
      driver: 'postgres',
      db,
      teardown: async () => {
        await db.core.close();
        await dropPostgresDatabase(baseUrl, name);
      }
    };
  }

  const schema = `db_test_${randomBytes(8).toString('hex')}`;

  await recreatePostgresSchema(baseUrl, schema);

  process.env['DATABASE_URL'] = baseUrl;

  const db = await createDatabase({ initialize: false, postgresSchema: schema });

  return {
    driver: 'postgres',
    db,
    teardown: async () => {
      await db.core.close();
      const cleanupSql = postgres(baseUrl, { max: 1, onnotice: () => undefined });
      await cleanupSql`DROP SCHEMA IF EXISTS ${cleanupSql(schema)} CASCADE`;
      await cleanupSql.end();
    }
  };
};
