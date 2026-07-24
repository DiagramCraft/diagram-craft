import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import {
  provisionSqliteDatabase,
  type ProvisionedDatabase
} from '../../db/testSupport/provisionDatabase';
import {
  createFixtureWorkspace,
  createFixtureSchema
} from '../../db/contract-tests/projectFixtures';
import { createFixtureUser } from '../../db/contract-tests/authFixtures';
import { syncEntityByExternalKey } from './entitySyncOperations';

const SOURCE = 'backstage';
const EXTERNAL_KEY = 'component:default/foo';

// createFixtureSchema writes the schema row directly and doesn't register a public-id sequence
// the way the real schemaOperations.createSchema does — register one so allocateEntityPublicId
// (used by the create branch of the sync operation) has a prefix to allocate against.
const createSyncableSchema = async (db: DatabaseAdapter, workspace: string) => {
  const schemaId = await createFixtureSchema(db, workspace);
  const schema = await db.catalog.getSchema(workspace, schemaId);
  await db.workspace.registerPublicIdPrefix(schema!.key_prefix, 'schema', schemaId, new Date());
  return schemaId;
};

describe('syncEntityByExternalKey', () => {
  let provisioned: ProvisionedDatabase;
  let actor: { id: string; displayName: string | null };

  beforeEach(async () => {
    provisioned = await provisionSqliteDatabase();
    const user = await createFixtureUser(provisioned.db);
    actor = { id: user.id, displayName: user.display_name };
  });

  afterEach(async () => {
    await provisioned.teardown();
  });

  it('creates an entity on first sync and records the external identity', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSyncableSchema(db, workspace);

    const result = await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      { _schemaId: schema, _name: 'Foo Service' },
      null,
      actor
    );

    expect(result.status).toBe('created');
    expect(result.entity['_name']).toBe('Foo Service');

    const identity = await db.externalIdentity.find(workspace, SOURCE, EXTERNAL_KEY);
    expect(identity?.entity_id).toBe(result.entity['_uid']);
  });

  it('returns unchanged for an identical repeat sync, without creating a new version', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSyncableSchema(db, workspace);
    const body = { _schemaId: schema, _name: 'Foo Service' };

    const first = await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      body,
      null,
      actor
    );
    const versionsAfterFirst = await db.catalog.listEntityVersions(
      workspace,
      first.entity['_uid'] as string
    );

    const second = await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      body,
      null,
      actor
    );

    expect(second.status).toBe('unchanged');
    expect(second.entity['_uid']).toBe(first.entity['_uid']);

    const versionsAfterSecond = await db.catalog.listEntityVersions(
      workspace,
      first.entity['_uid'] as string
    );
    expect(versionsAfterSecond).toHaveLength(versionsAfterFirst.length);
  });

  it('returns updated when a field value changes, converging on the same entity', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSyncableSchema(db, workspace);

    const first = await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      { _schemaId: schema, _name: 'Foo Service', _description: 'v1' },
      null,
      actor
    );
    const second = await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      { _schemaId: schema, _name: 'Foo Service', _description: 'v2' },
      null,
      actor
    );

    expect(second.status).toBe('updated');
    expect(second.entity['_uid']).toBe(first.entity['_uid']);
    expect(second.entity['_description']).toBe('v2');
  });

  it('rejects a payload with a field id not defined on the schema', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSyncableSchema(db, workspace);

    await expect(
      syncEntityByExternalKey(
        db,
        workspace,
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: schema, _name: 'Foo Service', bogusField: 'x' },
        null,
        actor
      )
    ).rejects.toThrow();
  });

  it('rejects changing the schema of an existing external identity', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSyncableSchema(db, workspace);
    const otherSchema = await createSyncableSchema(db, workspace);

    await syncEntityByExternalKey(
      db,
      workspace,
      SOURCE,
      EXTERNAL_KEY,
      { _schemaId: schema, _name: 'Foo Service' },
      null,
      actor
    );

    await expect(
      syncEntityByExternalKey(
        db,
        workspace,
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: otherSchema, _name: 'Foo Service' },
        null,
        actor
      )
    ).rejects.toThrow();
  });

  it('requires the ent.external_update capability', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);

    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    await expect(
      syncEntityByExternalKey(
        db,
        workspace,
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: schema, _name: 'Foo Service' },
        authCtx,
        actor
      )
    ).rejects.toThrow();
  });
});
