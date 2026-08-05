import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import type { EntityDbResult } from './db/catalogDatabase';
import { toApiEntity, toApiEntitySummary } from './entityHelpers';

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

const now = new Date('2025-06-01T12:00:00.000Z');

const baseEntity: EntityDbResult = {
  id: 'e-1',
  workspace: 'ws-1',
  public_id: 'ENT-1',
  slug: 'my-entity',
  namespace: 'ns',
  name: 'My Entity',
  description: 'A test entity',
  owner: 'team-a',
  lifecycle: 'lc-1',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['a', 'b'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: { custom: 'value' },
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: 'Team A',
  lifecycle_label: 'Production',
  target_lifecycle_label: null,
  schema_name: 'Service',
  completeness: 0
};

// ── toApiEntity ───────────────────────────────────────────────

describe('toApiEntity', () => {
  it('maps all standard fields', () => {
    const result = toApiEntity(baseEntity, null, null);
    expect(result._uid).toBe('e-1');
    expect(result._schema).toEqual({ id: 'schema-1', name: 'Service' });
    expect(result._name).toBe('My Entity');
    expect(result._slug).toBe('my-entity');
    expect(result._namespace).toBe('ns');
    expect(result._description).toBe('A test entity');
    expect(result._owner).toEqual({ id: 'team-a', name: 'Team A' });
    expect(result._lifecycle).toEqual({ id: 'lc-1', name: 'Production' });
    expect(result._tags).toEqual(['a', 'b']);
    expect(result._projectId).toBeNull();
  });

  it('spreads entity.data into the result', () => {
    const result = toApiEntity(baseEntity, null, {
      fields: [{ id: 'custom', name: 'Custom', type: 'text' }],
      groups: []
    });
    expect(result.custom).toBe('value');
  });

  it('fails closed for missing schemas and stale field keys', () => {
    const missingSchema = toApiEntity(
      { ...baseEntity, data: { custom: 'value', stale: 'secret' } },
      authCtxWithTeamRoles({}),
      null
    );
    expect(missingSchema).not.toHaveProperty('custom');
    expect(missingSchema).not.toHaveProperty('stale');

    const knownSchema = toApiEntity(
      { ...baseEntity, data: { custom: 'value', stale: 'secret' } },
      authCtxWithTeamRoles({}),
      { fields: [{ id: 'custom', name: 'Custom', type: 'text' }], groups: [] }
    );
    expect(knownSchema.custom).toBe('value');
    expect(knownSchema).not.toHaveProperty('stale');
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntity(baseEntity, null, null);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(true);
    expect(result.canDelete).toBe(true);
    expect(result.canAdmin).toBe(true);
    expect(result.canCreateChild).toBe(true);
  });

  it('omits fields in a restricted group the caller cannot view', () => {
    const entity: EntityDbResult = {
      ...baseEntity,
      data: { custom: 'value', secret: 'hidden' }
    };
    const schema = {
      fields: [
        { id: 'custom', name: 'Custom', requirementLevel: null, type: 'text' } as never,
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
    const authCtx = authCtxWithTeamRoles({});

    const result = toApiEntity(entity, authCtx, schema);

    expect(result.custom).toBe('value');
    expect((result as Record<string, unknown>).secret).toBeUndefined();
  });

  it('omits external metadata for fields in a restricted group the caller cannot view', () => {
    const entity: EntityDbResult = {
      ...baseEntity,
      data: { custom: 'value', secret: 'hidden' },
      generated_metadata: {
        custom: {
          fieldId: 'custom',
          external_kind: 'ai',
          status: 'success',
          source: 'updater',
          timestamp: now.toISOString()
        } as never,
        secret: {
          fieldId: 'secret',
          external_kind: 'ai',
          status: 'success',
          source: 'updater',
          timestamp: now.toISOString(),
          explanation: 'This is confidential'
        } as never
      }
    };
    const schema = {
      fields: [
        { id: 'custom', name: 'Custom', requirementLevel: null, type: 'text' } as never,
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
    const authCtx = authCtxWithTeamRoles({});

    const result = toApiEntity(entity, authCtx, schema);

    expect(result._externalMetadata?.custom).toBeDefined();
    expect(result._externalMetadata?.secret).toBeUndefined();
  });
});

// ── toApiEntitySummary ────────────────────────────────────────

describe('toApiEntitySummary', () => {
  it('maps standard fields without data spread', () => {
    const result = toApiEntitySummary(baseEntity, null, null);
    expect(result._uid).toBe('e-1');
    expect(result._name).toBe('My Entity');
    expect((result as Record<string, unknown>).custom).toBeUndefined();
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntitySummary(baseEntity, null, null);
    expect(result.canView).toBe(true);
  });

  it('omits external metadata for fields in a restricted group the caller cannot view', () => {
    const entity: EntityDbResult = {
      ...baseEntity,
      generated_metadata: {
        custom: {
          fieldId: 'custom',
          external_kind: 'ai',
          status: 'success',
          source: 'updater',
          timestamp: now.toISOString()
        } as never,
        secret: {
          fieldId: 'secret',
          external_kind: 'ai',
          status: 'success',
          source: 'updater',
          timestamp: now.toISOString(),
          explanation: 'This is confidential'
        } as never
      }
    };
    const schema = {
      fields: [
        { id: 'custom', name: 'Custom', requirementLevel: null, type: 'text' } as never,
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
    const authCtx = authCtxWithTeamRoles({});

    const result = toApiEntitySummary(entity, authCtx, schema);

    expect(result._externalMetadata?.custom).toBeDefined();
    expect(result._externalMetadata?.secret).toBeUndefined();
  });
});
