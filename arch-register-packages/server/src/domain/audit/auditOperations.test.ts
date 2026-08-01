import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import { redactAuditEntryChanges } from './auditOperations';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';

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
  created_at: new Date(),
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

const schemaById = new Map([[schema.id, schema]]);

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
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schemaById);
    expect(result.changes).toEqual({
      old: { name: 'old-name' },
      new: { name: 'new-name' }
    });
  });

  it('keeps restricted field values for a caller with view access', () => {
    const entry = makeEntry();
    const authCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });
    const result = redactAuditEntryChanges(entry, authCtx, schemaById);
    expect(result.changes).toEqual(entry.changes);
  });

  it('leaves non-entity entries untouched', () => {
    const entry = makeEntry({ entity_type: 'project', schema_id: null });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schemaById);
    expect(result.changes).toEqual(entry.changes);
  });

  it('leaves entries with no matching schema untouched', () => {
    const entry = makeEntry({ schema_id: 'unknown-schema' });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schemaById);
    expect(result.changes).toEqual(entry.changes);
  });

  it('handles create entries with only a "new" side', () => {
    const entry = makeEntry({ operation: 'create', changes: { new: { name: 'x', secret: 'y' } } });
    const result = redactAuditEntryChanges(entry, authCtxWithTeamRoles({}), schemaById);
    expect(result.changes).toEqual({ new: { name: 'x' } });
  });
});
