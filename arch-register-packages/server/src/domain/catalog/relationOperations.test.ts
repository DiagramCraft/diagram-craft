import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import {
  createWorkspaceRelation,
  updateWorkspaceRelation,
  deleteWorkspaceRelation,
  restoreWorkspaceRelationVersion
} from './relationOperations';
import type { EntityVersionDbResult, EntityVersionSummaryDbResult } from './db/catalogDatabase';

const authorizationMocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn()
}));

vi.mock('../auth/authorization', async () => ({
  ...(await vi.importActual<typeof import('../auth/authorization')>('../auth/authorization')),
  buildApiAuthCtx: authorizationMocks.buildApiAuthCtx
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../audit/db/auditLogging', async () => ({
  ...(await vi.importActual<typeof import('../audit/db/auditLogging')>('../audit/db/auditLogging')),
  logAudit: vi.fn(async () => {})
}));

const now = new Date('2026-06-29T12:00:00.000Z');

const authCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'editor',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const event = {} as AuthenticatedEvent;
const eventForAuthCtx = () => {
  authorizationMocks.buildApiAuthCtx.mockResolvedValueOnce(authCtx);
  return event;
};

const entitySchema: SchemaDbResult = {
  id: 'schema-app',
  workspace: 'ws-1',
  name: 'App',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'APP',
  created_at: now,
  updated_at: now
};

const makeEntity = (id: string): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: `APP-${id}`,
  slug: id,
  namespace: 'default',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: entitySchema.id,
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: entitySchema.name,
  completeness: 0
});

const inEntity = makeEntity('entity-in');
const outEntity = makeEntity('entity-out');

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Depends On',
  description: '',
  in_schema_ids: [entitySchema.id],
  out_schema_ids: [entitySchema.id],
  fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' } as never],
  groups: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  created_at: now,
  updated_at: now
};

const makeRelationRow = (overrides: Partial<RelationDbResult> = {}): RelationDbResult => ({
  id: 'relation-1',
  workspace: 'ws-1',
  schema_id: relationSchema.id,
  schema_name: relationSchema.name,
  in_entity_id: inEntity.id,
  in_entity_name: inEntity.name,
  out_entity_id: outEntity.id,
  out_entity_name: outEntity.name,
  data: {},
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeDb = (
  existingRow?: RelationDbResult,
  existingVersions: EntityVersionSummaryDbResult[] = [],
  versionToRestore: EntityVersionDbResult | null = null
) => {
  const createEntityVersion = vi.fn(async () => ({}));
  const pruneAutosaveVersions = vi.fn(async () => {});
  const createRelation = vi.fn(async () => makeRelationRow());
  const updateRelation = vi.fn(
    async (_ws: string, _id: string, input: { version: number; data: Record<string, unknown> }) =>
      makeRelationRow({ version: input.version, data: input.data, updated_at: new Date() })
  );
  const deleteRelation = vi.fn(async () => existingRow ?? makeRelationRow());

  const db = {
    relation: {
      getRelationSchema: vi.fn(async () => relationSchema),
      createRelation,
      updateRelation,
      deleteRelation,
      getRelation: vi.fn(async () => existingRow ?? makeRelationRow())
    },
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) =>
        id === inEntity.id ? inEntity : id === outEntity.id ? outEntity : null
      ),
      listSchemas: vi.fn(async () => [entitySchema]),
      createEntityVersion,
      pruneAutosaveVersions,
      listEntityVersions: vi.fn(async () => existingVersions),
      getEntityVersionById: vi.fn(async () => versionToRestore)
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    createEntityVersion,
    pruneAutosaveVersions,
    createRelation,
    updateRelation,
    deleteRelation
  };
};

describe('createWorkspaceRelation — version history', () => {
  it('writes a record_version row and prunes autosaves after creating a relation', async () => {
    const { db, createEntityVersion, pruneAutosaveVersions } = makeDb();

    const row = await createWorkspaceRelation(
      db,
      'ws-1',
      { _schemaId: relationSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
      eventForAuthCtx()
    );

    expect(row._uid).toBe('relation-1');
    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'relation-1',
        kind: 'autosave',
        version_number: 1,
        state: expect.objectContaining({
          id: 'relation-1',
          in_entity_id: inEntity.id,
          out_entity_id: outEntity.id
        })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', 'relation-1', 50);
  });
});

describe('updateWorkspaceRelation — version history', () => {
  it('writes a new record_version row reflecting the bumped version on update', async () => {
    const existing = makeRelationRow({ version: 1, data: { note: 'before' } });
    const { db, createEntityVersion, pruneAutosaveVersions } = makeDb(existing);

    await updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx());

    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: existing.id,
        kind: 'autosave',
        version_number: 2,
        state: expect.objectContaining({ data: { note: 'after' } })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', existing.id, 50);
  });
});

describe('deleteWorkspaceRelation — version history', () => {
  it('soft-deletes and writes a deleted record_version continuing the version sequence', async () => {
    const existing = makeRelationRow({ version: 2 });
    const priorVersions = [
      { version_number: 1 },
      { version_number: 2 }
    ] as EntityVersionSummaryDbResult[];
    const { db, createEntityVersion, deleteRelation } = makeDb(existing, priorVersions);

    const result = await deleteWorkspaceRelation(db, 'ws-1', existing.id, eventForAuthCtx());

    expect(result.success).toBe(true);
    expect(deleteRelation).toHaveBeenCalledWith('ws-1', existing.id);
    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: existing.id,
        kind: 'deleted',
        version_number: 3,
        state: expect.objectContaining({ id: existing.id })
      })
    );
  });
});

describe('restoreWorkspaceRelationVersion', () => {
  it('re-applies the version data, writes a restored record_version, and returns the restored-from version', async () => {
    const existing = makeRelationRow({ version: 2, data: { note: 'current' } });
    const versionToRestore: EntityVersionDbResult = {
      id: 'version-1',
      workspace: 'ws-1',
      entity_id: existing.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: now,
      created_by: 'user-1',
      created_by_name: 'User',
      state: { id: existing.id, data: { note: 'old' } },
      applied_case_revision_id: null
    };
    const { db, createEntityVersion, updateRelation, pruneAutosaveVersions } = makeDb(
      existing,
      [],
      versionToRestore
    );

    const result = await restoreWorkspaceRelationVersion(
      db,
      'ws-1',
      existing.id,
      'version-1',
      'restoring an old note',
      eventForAuthCtx()
    );

    expect(updateRelation).toHaveBeenCalledWith(
      'ws-1',
      existing.id,
      expect.objectContaining({ data: { note: 'old' }, version: 3 })
    );
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: existing.id,
        kind: 'restored',
        version_number: 3,
        commit_message: 'restoring an old note',
        state: expect.objectContaining({ data: { note: 'old' } })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', existing.id, 50);
    // The response reflects the version that was restored from, mirroring entityVersionOrpc.ts.
    expect(result.id).toBe('version-1');
  });
});
