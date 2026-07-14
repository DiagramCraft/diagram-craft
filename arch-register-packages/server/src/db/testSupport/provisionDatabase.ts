import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import type { DatabaseAdapter, DbDriver } from '../database';
import { createDatabase } from '../factory';

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

export const provisionPostgresDatabase = async (): Promise<ProvisionedDatabase> => {
  const baseUrl = process.env['DATABASE_URL'];
  if (!baseUrl) throw new Error('DATABASE_URL is required to provision a postgres database');

  const schema = `db_test_${randomBytes(8).toString('hex')}`;

  const adminSql = postgres(baseUrl, { max: 1, onnotice: () => undefined });
  await adminSql`CREATE SCHEMA ${adminSql(schema)}`;
  await adminSql.end();

  process.env['DB_DRIVER'] = 'postgres';
  process.env['DATABASE_URL'] = baseUrl;

  const db = await createDatabase({ initialize: false, postgresSchema: schema });
  await db.core.reset();

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
