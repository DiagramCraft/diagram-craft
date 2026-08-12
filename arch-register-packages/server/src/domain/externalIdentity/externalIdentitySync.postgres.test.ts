import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import {
  provisionPostgresDatabase,
  type ProvisionedDatabase
} from '../../db/testSupport/provisionDatabase';
import {
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../../db/testSupport/fixtures';
import { syncEntityByExternalKey } from './entitySyncOperations';

const SOURCE = 'backstage';
const EXTERNAL_KEY = 'component:default/concurrent';

const withConcurrentIdentityReadBarrier = (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string
): DatabaseAdapter => {
  let reads = 0;
  let release!: () => void;
  const bothReads = new Promise<void>(resolve => {
    release = resolve;
  });

  const wrapTransaction = (tx: DatabaseAdapter): DatabaseAdapter => ({
    ...tx,
    externalIdentity: {
      ...tx.externalIdentity,
      find: async (findWorkspace, findSource, findExternalKey) => {
        if (
          findWorkspace === workspace &&
          findSource === source &&
          findExternalKey === externalKey &&
          reads < 2
        ) {
          reads += 1;
          if (reads === 2) release();
          await bothReads;
        }
        return tx.externalIdentity.find(findWorkspace, findSource, findExternalKey);
      }
    }
  });

  return {
    ...db,
    core: {
      ...db.core,
      transaction: async <T>(callback: (tx: DatabaseAdapter) => Promise<T>) =>
        db.core.transaction(tx => callback(wrapTransaction(tx)))
    }
  };
};

describe.skipIf(!process.env['DATABASE_URL'])('PostgreSQL external identity sync races', () => {
  let provisioned: ProvisionedDatabase;

  beforeEach(async () => {
    provisioned = await provisionPostgresDatabase();
  });

  afterEach(async () => {
    await provisioned.teardown();
  });

  it('converges concurrent first syncs without leaving an orphaned record', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = await db.catalog.getSchema(workspace, schemaId);
    await db.workspace.registerPublicIdPrefix(schema!.key_prefix, 'schema', schemaId, new Date());
    const user = await createFixtureUser(db);
    const actor = { id: user.id, displayName: user.display_name };
    const concurrentDb = withConcurrentIdentityReadBarrier(db, workspace, SOURCE, EXTERNAL_KEY);
    const body = { _schemaId: schemaId, _name: 'Concurrent component' };

    const results = await Promise.all([
      syncEntityByExternalKey(concurrentDb, workspace, SOURCE, EXTERNAL_KEY, body, null, actor),
      syncEntityByExternalKey(concurrentDb, workspace, SOURCE, EXTERNAL_KEY, body, null, actor)
    ]);

    expect(results.map(result => result.status).sort()).toEqual(['created', 'unchanged']);
    expect(new Set(results.map(result => result.entity['_uid']))).toHaveLength(1);

    const entities = await db.catalog.listEntities(workspace);
    expect(entities).toHaveLength(1);
    const identity = await db.externalIdentity.find(workspace, SOURCE, EXTERNAL_KEY);
    expect(identity?.record_id).toBe(entities[0]!.id);
    expect(await db.catalog.listEntityVersions(workspace, entities[0]!.id)).toHaveLength(1);
  });
});
