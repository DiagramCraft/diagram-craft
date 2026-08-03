import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { AuditLogDbResult } from './db/auditDatabase';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(),
  requireWorkspaceCapability: vi.fn()
}));

import { redactAuditEntryChanges, listAuditLog } from './auditOperations';
import { buildApiAuthCtx } from '../auth/authorization';

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Test Schema',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'T',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date(),
  fields: [
    { id: 'name', name: 'Name', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ]
};

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Test Relation Schema',
  description: '',
  in_schema_ids: ['schema-1'],
  out_schema_ids: ['schema-1'],
  color: null,
  icon: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date(),
  fields: [
    { id: 'name', name: 'Name', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ]
};

const makeEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'audit-1',
  workspace: 'ws-1',
  timestamp: '2026-05-27T10:00:00.000Z',
  user_id: 'u-1',
  user_display_name: null,
  operation: 'update',
  entity_type: 'entity',
  entity_id: 'e-1',
  public_id: null,
  entity_name: 'My Entity',
  entity_slug: 'my-entity',
  schema_id: schema.id,
  changes: {
    old: { name: 'old-name', secret: 'old-secret' },
    new: { name: 'new-name', secret: 'new-secret' }
  },
  metadata: {},
  ...overrides
});

describe('redactAuditEntryChanges', () => {
  it('omits restricted field values for a caller without view access', () => {
    const entry = makeEntry();
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schema, null);
    expect(result.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });

  it('keeps restricted field values for a caller with view access', () => {
    const entry = makeEntry();
    const authCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const result = redactAuditEntryChanges(entry, authCtx, schema, null);
    expect(result.changes).toEqual(entry.changes);
  });

  it('leaves non-entity, non-relation entries untouched', () => {
    const entry = makeEntry({ entity_type: 'project', schema_id: null });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, null);
    expect(result.changes).toEqual(entry.changes);
  });

  it('fails closed for entries with no matching schema', () => {
    const entry = makeEntry({ schema_id: 'unknown-schema' });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, null);
    expect(result.changes).toEqual({ old: {}, new: {} });
  });

  it('fails closed for entity entries without a schema id', () => {
    const entry = makeEntry({ schema_id: null });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, null);
    expect(result.changes).toEqual({ old: {}, new: {} });
  });

  it('handles create entries with only a "new" side', () => {
    const entry = makeEntry({ operation: 'create', changes: { new: { name: 'x', secret: 'y' } } });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schema, null);
    expect(result.changes).toEqual({ new: { name: 'x' } });
  });

  it('omits restricted relation field values for a caller without view access', () => {
    const entry = makeEntry({ entity_type: 'relation', schema_id: relationSchema.id });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, relationSchema);
    expect(result.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });

  it('keeps restricted relation field values for a caller with view access', () => {
    const entry = makeEntry({ entity_type: 'relation', schema_id: relationSchema.id });
    const authCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const result = redactAuditEntryChanges(entry, authCtx, null, relationSchema);
    expect(result.changes).toEqual(entry.changes);
  });

  it('fails closed for relation entries with no matching schema', () => {
    const entry = makeEntry({ entity_type: 'relation', schema_id: 'unknown-relation-schema' });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, null);
    expect(result.changes).toEqual({ old: {}, new: {} });
  });

  it('leaves relation_schema entries untouched (no schema_id is ever logged for them)', () => {
    const entry = makeEntry({ entity_type: 'relation_schema', schema_id: null });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), null, null);
    expect(result.changes).toEqual(entry.changes);
  });
});

describe('listAuditLog', () => {
  const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

  const rawRow: AuditLogDbResult = {
    id: 'audit-1',
    workspace: 'ws-1',
    timestamp: new Date('2026-05-27T10:00:00.000Z'),
    user_id: 'u-1',
    user_display_name: null,
    operation: 'update',
    entity_type: 'entity',
    entity_id: 'e-1',
    entity_name: 'My Entity',
    entity_slug: 'my-entity',
    schema_id: schema.id,
    changes: {
      old: { name: 'old-name', secret: 'old-secret' },
      new: { name: 'new-name', secret: 'new-secret' }
    },
    metadata: {}
  };

  const relationRawRow: AuditLogDbResult = {
    id: 'audit-2',
    workspace: 'ws-1',
    timestamp: new Date('2026-05-27T10:00:00.000Z'),
    user_id: 'u-1',
    user_display_name: null,
    operation: 'update',
    entity_type: 'relation',
    entity_id: 'r-1',
    entity_name: 'Entity A -> Entity B',
    entity_slug: null,
    schema_id: relationSchema.id,
    changes: {
      old: { name: 'old-name', secret: 'old-secret' },
      new: { name: 'new-name', secret: 'new-secret' }
    },
    metadata: {}
  };

  const makeDb = (
    rows: AuditLogDbResult[] = [rawRow],
    currentSchema = schema,
    schemaVersions: unknown[] = []
  ): DatabaseAdapter =>
    ({
      catalog: {
        listSchemas: vi.fn(async () => [currentSchema]),
        getSchema: vi.fn(async () => currentSchema),
        listSchemaVersions: vi.fn(async () => schemaVersions),
        getEntity: vi.fn(async () => ({ id: 'e-1', workspace: 'ws-1', public_id: 'ENT-1' }))
      },
      relation: {
        listRelationSchemas: vi.fn(async () => [relationSchema]),
        getRelationSchema: vi.fn(async () => relationSchema),
        listRelationSchemaVersions: vi.fn(async () => [])
      },
      audit: {
        listAuditLogs: vi.fn(async () => rows)
      }
    }) as unknown as DatabaseAdapter;

  it('redacts restricted field values end-to-end for a caller without view access', async () => {
    vi.mocked(buildApiAuthCtx).mockResolvedValueOnce(authCtxWithTeamRoles({}));

    const result = await listAuditLog(makeDb(), 'ws-1', {}, event);

    expect(result).toHaveLength(1);
    expect(result[0]!.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });

  it('keeps restricted field values end-to-end for a caller with view access', async () => {
    vi.mocked(buildApiAuthCtx).mockResolvedValueOnce(
      authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] })
    );

    const result = await listAuditLog(makeDb(), 'ws-1', {}, event);

    expect(result[0]!.changes).toEqual(rawRow.changes);
  });

  it('redacts restricted relation field values end-to-end for a caller without view access', async () => {
    vi.mocked(buildApiAuthCtx).mockResolvedValueOnce(authCtxWithTeamRoles({}));

    const result = await listAuditLog(makeDb([relationRawRow]), 'ws-1', {}, event);

    expect(result).toHaveLength(1);
    expect(result[0]!.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });

  it('keeps restricted relation field values end-to-end for a caller with view access', async () => {
    vi.mocked(buildApiAuthCtx).mockResolvedValueOnce(
      authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] })
    );

    const result = await listAuditLog(makeDb([relationRawRow]), 'ws-1', {}, event);

    expect(result[0]!.changes).toEqual(relationRawRow.changes);
  });

  it('uses the historical schema when current field-group access changed', async () => {
    const currentSchema = {
      ...schema,
      fields: [{ id: 'name', name: 'Name', requirementLevel: null, type: 'text' } as never],
      groups: []
    };
    const historicalSchema = {
      ...schema,
      created_at: new Date('2026-01-01T00:00:00.000Z')
    };
    vi.mocked(buildApiAuthCtx).mockResolvedValueOnce(authCtxWithTeamRoles({}));

    const result = await listAuditLog(
      makeDb([rawRow], currentSchema, [historicalSchema]),
      'ws-1',
      {},
      event
    );

    expect(result[0]!.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });
});
