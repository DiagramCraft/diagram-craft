import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { importCommit, importParse } from './importOperations';

const now = new Date('2026-06-29T12:00:00.000Z');

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [
    { id: 'name_field', name: 'Name field', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-owner'] } }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const existingEntity: EntityDbResult = {
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'SRV-1',
  slug: 'my-entity',
  namespace: 'default',
  name: 'My Entity',
  description: '',
  owner: 'team-owner',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: { name_field: 'x', secret: 'original' },
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  completeness: 0
};

const makeDb = () =>
  ({
    catalog: {
      getSchema: vi.fn(async () => schema),
      listEntitiesPaginated: vi.fn(async () => [existingEntity]),
      updateEntity: vi.fn(async (_ws: string, _id: string, input: Record<string, unknown>) => ({
        ...existingEntity,
        ...input
      })),
      createEntity: vi.fn(async (input: Record<string, unknown>) => ({
        ...input,
        owner_name: null,
        schema_name: 'Service'
      })),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    },
    workspace: {
      listLifecycleStates: vi.fn(async () => []),
      listTeams: vi.fn(async () => [{ id: 'team-owner' }]),
      allocatePublicId: vi.fn(async () => 1)
    },
    audit: {
      createAuditLog: vi.fn(async () => ({ id: 'audit-1' }))
    },
    watch: {
      listWatcherUserIds: vi.fn(async () => []),
      createNotificationsFromAudit: vi.fn(async () => {})
    }
  }) as unknown as DatabaseAdapter;

const authCtxWithTeamRole = (role: 'team_reviewer' | 'team_editor' | 'team_admin' | null) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: role ? [{ teamId: 'team-owner', role }] : [],
    schemas: [],
    entities: [],
    grants: []
  });

describe('importCommit — restricted field group writes', () => {
  it('rejects updating a restricted field via CSV import when the caller cannot edit it', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      importCommit(db, authCtx, {
        workspace: 'ws-1',
        schemaId: 'schema-1',
        entities: [{ _existingId: 'entity-1', name_field: 'x', secret: 'changed' }],
        auditUser: { id: 'user-1', display_name: 'User' }
      })
    ).rejects.toThrow();
  });

  it('allows updating a restricted field via CSV import when the caller has team_editor access', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole('team_editor');

    await importCommit(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      entities: [{ _existingId: 'entity-1', name_field: 'x', secret: 'changed' }],
      auditUser: { id: 'user-1', display_name: 'User' }
    });

    expect(db.catalog.updateEntity).toHaveBeenCalled();
  });

  it('rejects creating an entity with a restricted value via CSV import when the caller cannot edit it', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      importCommit(db, authCtx, {
        workspace: 'ws-1',
        schemaId: 'schema-1',
        entities: [{ _name: 'New Entity', name_field: 'x', secret: 'sneaked-in' }],
        auditUser: { id: 'user-1', display_name: 'User' }
      })
    ).rejects.toThrow();

    expect(db.catalog.createEntity).not.toHaveBeenCalled();
  });

  it('allows creating an entity with a restricted value via CSV import when the caller has team_editor access', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole('team_editor');

    await importCommit(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      entities: [{ _name: 'New Entity', name_field: 'x', secret: 'allowed' }],
      auditUser: { id: 'user-1', display_name: 'User' }
    });

    expect(db.catalog.createEntity).toHaveBeenCalled();
  });

  it('preserves a restricted field the caller cannot see when the CSV omits its column', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole(null);

    await importCommit(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      entities: [{ _existingId: 'entity-1', name_field: 'y' }],
      auditUser: { id: 'user-1', display_name: 'User' }
    });

    expect(db.catalog.updateEntity).toHaveBeenCalled();
    const [, , updateInput] = (db.catalog.updateEntity as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, string, { data: Record<string, unknown> }];
    expect(updateInput.data).toEqual({ name_field: 'y', secret: 'original' });
  });
});

describe('importParse — restricted field group reads', () => {
  const csvContent = 'ID,Name,Name field\nentity-1,My Entity,x\n';

  it('rejects a CSV row that attempts to write a restricted field', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole(null);

    const result = await importParse(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      csvContent: 'Name,Name field,Secret\nNew Entity,x,sneaked\n'
    });

    expect(result.entities[0]?.errors).toContain(
      'You do not have permission to set one or more restricted fields'
    );
    expect(result.entities[0]?.entity).toBeNull();
  });

  it('omits a restricted field from the preview when the caller cannot view it', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole(null);

    const result = await importParse(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      csvContent
    });

    expect(result.entities[0]?.existingEntity).not.toBeNull();
    expect(result.entities[0]?.existingEntity).not.toHaveProperty('secret');
  });

  it('includes a restricted field in the preview when the caller has team_editor access', async () => {
    const db = makeDb();
    const authCtx = authCtxWithTeamRole('team_editor');

    const result = await importParse(db, authCtx, {
      workspace: 'ws-1',
      schemaId: 'schema-1',
      csvContent
    });

    expect(result.entities[0]?.existingEntity).toMatchObject({ secret: 'original' });
  });
});
