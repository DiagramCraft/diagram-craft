import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from './database';
import { provisionSqliteDatabase, type ProvisionedDatabase } from './testSupport/provisionDatabase';
import { createFixtureWorkspace } from './testSupport/fixtures';

describe('SqliteDatabase savepoints', () => {
  let provisioned: ProvisionedDatabase;

  beforeEach(async () => {
    provisioned = await provisionSqliteDatabase();
  });

  afterEach(async () => {
    await provisioned.teardown();
  });

  it('rolls back nested writes while keeping the outer transaction usable', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const rolledBackSchema = randomUUID();
    const committedSchema = randomUUID();

    const createSchema = async (transactionDb: DatabaseAdapter, id: string) =>
      transactionDb.catalog.createSchema({
        id,
        workspace,
        name: `Schema ${id}`,
        description: '',
        fields: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: id.slice(0, 8).toUpperCase(),
        created_at: new Date(),
        updated_at: new Date()
      });

    await db.core.transaction(async tx => {
      await expect(
        tx.core.savepoint(async nested => {
          await createSchema(nested, rolledBackSchema);
          throw new Error('rollback savepoint');
        })
      ).rejects.toThrow('rollback savepoint');

      expect(await tx.catalog.getSchema(workspace, rolledBackSchema)).toBeNull();
      await createSchema(tx, committedSchema);
    });

    expect(await db.catalog.getSchema(workspace, rolledBackSchema)).toBeNull();
    expect(await db.catalog.getSchema(workspace, committedSchema)).not.toBeNull();
  });
});
