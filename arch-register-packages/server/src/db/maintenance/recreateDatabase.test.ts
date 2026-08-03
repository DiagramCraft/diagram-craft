import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { recreatePostgresSchema } from './recreateDatabase';

const connectionString = process.env['DATABASE_URL'];

describe.skipIf(!connectionString)('recreatePostgresSchema', () => {
  const schema = `db_reset_test_${randomBytes(8).toString('hex')}`;
  let sql: ReturnType<typeof postgres>;

  it('removes every schema object and reapplies the schema repeatedly', async () => {
    await recreatePostgresSchema(connectionString!, schema);
    sql = postgres(connectionString!, {
      max: 1,
      connection: { search_path: schema },
      onnotice: () => undefined
    });

    await sql`CREATE TABLE unmanaged_table (id INTEGER PRIMARY KEY)`;
    await sql`CREATE VIEW unmanaged_view AS SELECT id FROM unmanaged_table`;

    await recreatePostgresSchema(connectionString!, schema);

    const objects = await sql<{ table_name: string | null; view_name: string | null }[]>`
      SELECT
        to_regclass(${`${schema}.unmanaged_table`})::text AS table_name,
        to_regclass(${`${schema}.unmanaged_view`})::text AS view_name
    `;
    const migrationState = await sql<{ migration_count: number; has_workspace: boolean }[]>`
      SELECT
        (SELECT COUNT(*)::int FROM schema_migrations) AS migration_count,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = 'workspace'
        ) AS has_workspace
    `;

    expect(objects[0]).toEqual({ table_name: null, view_name: null });
    expect(migrationState[0]?.migration_count).toBeGreaterThan(0);
    expect(migrationState[0]?.has_workspace).toBe(true);
  });

  afterAll(async () => {
    await sql?.end();
    const adminSql = postgres(connectionString!, { max: 1, onnotice: () => undefined });
    await adminSql`DROP SCHEMA IF EXISTS ${adminSql(schema)} CASCADE`;
    await adminSql.end();
  });
});
