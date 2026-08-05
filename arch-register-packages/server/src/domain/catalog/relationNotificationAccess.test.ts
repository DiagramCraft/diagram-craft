import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { canViewRelationNotification } from './relationNotificationAccess';

const relationSchema = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Depends on',
  description: '',
  in_schema_ids: ['owner-schema-1'],
  out_schema_ids: ['owner-schema-1'],
  fields: [],
  groups: [],
  color: null,
  icon: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const ownerSchema = (groupId?: string, createdAt = '2026-01-01T00:00:00.000Z') => ({
  id: 'owner-schema-1',
  workspace: 'ws-1',
  name: 'Owner schema',
  description: '',
  fields: (['in', 'out'] as const).map(direction => ({
    id: `depends-on-${direction}`,
    name: 'Depends on',
    type: 'typedRelation',
    relationSchemaId: 'relation-schema-1',
    direction,
    requirementLevel: null,
    ...(groupId ? { groupId } : {})
  })),
  groups: groupId
    ? [{ id: groupId, name: 'Restricted', accessControl: { teamIds: ['team-reviewers'] } }]
    : [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'OWN',
  created_at: new Date(createdAt),
  updated_at: new Date(createdAt)
});

const authContext = (reviewer: boolean) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: reviewer ? [{ teamId: 'team-reviewers', role: 'team_reviewer' as const }] : [],
    schemas: [],
    entities: [],
    grants: []
  });

const makeDb = (currentSchema: ReturnType<typeof ownerSchema>, versions: unknown[] = []) =>
  ({
    relation: {
      getRelationSchema: vi.fn(async () => relationSchema),
      listRelationSchemaVersions: vi.fn(async () => [])
    },
    catalog: {
      getEntity: vi.fn(async (_workspace: string, id: string) => ({
        id,
        schema_id: 'owner-schema-1'
      })),
      getSchema: vi.fn(async () => currentSchema),
      listSchemaVersions: vi.fn(async () => versions)
    }
  }) as unknown as DatabaseAdapter;

const input = {
  relationSchemaId: 'relation-schema-1',
  inEntityId: 'entity-in',
  outEntityId: 'entity-out',
  at: new Date('2026-03-01T00:00:00.000Z')
};

describe('canViewRelationNotification', () => {
  it('denies a recipient without access to the owner typedRelation field', async () => {
    const visible = await canViewRelationNotification(
      makeDb(ownerSchema('restricted')),
      'ws-1',
      authContext(false),
      input
    );

    expect(visible).toBe(false);
  });

  it('allows a recipient with reviewer access to the owner typedRelation field', async () => {
    const visible = await canViewRelationNotification(
      makeDb(ownerSchema('restricted')),
      'ws-1',
      authContext(true),
      input
    );

    expect(visible).toBe(true);
  });

  it('uses the historical owner schema rather than the current schema', async () => {
    const visible = await canViewRelationNotification(
      makeDb(ownerSchema(undefined, '2026-06-01T00:00:00.000Z'), [ownerSchema('restricted')]),
      'ws-1',
      authContext(false),
      input
    );

    expect(visible).toBe(false);
  });

  it('fails closed when an owner schema is unavailable', async () => {
    const visible = await canViewRelationNotification(
      makeDb(ownerSchema(undefined, '2026-04-01T00:00:00.000Z'), [
        ownerSchema(undefined, '2026-04-01T00:00:00.000Z')
      ]),
      'ws-1',
      authContext(true),
      input
    );

    expect(visible).toBe(false);
  });
});
