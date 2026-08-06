import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import { filterRelationFieldData, toApiRelation, toRedactedApiRelation } from './relationHelpers';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';

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

const now = new Date('2026-06-01T12:00:00.000Z');

const schema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'workspace-1',
  name: 'Depends on',
  description: '',
  in_schema_ids: ['entity-schema-1'],
  out_schema_ids: ['entity-schema-2'],
  fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
  groups: [],
  shared_field_group_links: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  version: 1,
  created_at: now,
  updated_at: now
};

const relation: RelationDbResult = {
  id: 'relation-1',
  workspace: 'workspace-1',
  schema_id: 'relation-schema-1',
  schema_name: 'Depends on',
  in_entity_id: 'entity-1',
  in_entity_name: 'Entity 1',
  out_entity_id: 'entity-2',
  out_entity_name: 'Entity 2',
  data: { note: 'known', removed: 'sensitive historical value' },
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now
};

describe('relation response redaction', () => {
  it('keeps declared fields and drops unknown fields', () => {
    expect(filterRelationFieldData(null, schema, relation.data)).toEqual({ note: 'known' });
  });

  it('fails closed when the relation schema is missing', () => {
    expect(filterRelationFieldData(null, null, relation.data)).toEqual({});
  });

  it('preserves relation metadata while redacting its field values', () => {
    expect(toRedactedApiRelation(relation, null, null)).toMatchObject({
      _uid: 'relation-1',
      _schema: { id: 'relation-schema-1', name: 'Depends on' },
      _in: { id: 'entity-1', name: 'Entity 1' },
      _out: { id: 'entity-2', name: 'Entity 2' }
    });
    expect(toRedactedApiRelation(relation, null, null)).not.toHaveProperty('removed');
    expect(toRedactedApiRelation(relation, null, null)).not.toHaveProperty('note');
  });
});

describe('toApiRelation — _externalMetadata', () => {
  it('surfaces external metadata when no schema/ACL restricts it', () => {
    const relationWithMetadata: RelationDbResult = {
      ...relation,
      generated_metadata: {
        note: {
          fieldId: 'note',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never
      }
    };

    const result = toApiRelation(relationWithMetadata, null, schema);
    expect(result._externalMetadata?.note).toBeDefined();
  });

  it('omits external metadata for fields in a restricted group the caller cannot view', () => {
    const restrictedSchema: RelationSchemaDbResult = {
      ...schema,
      fields: [
        { id: 'note', name: 'Note', requirementLevel: null, type: 'text' } as never,
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
    const relationWithMetadata: RelationDbResult = {
      ...relation,
      generated_metadata: {
        note: {
          fieldId: 'note',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never,
        secret: {
          fieldId: 'secret',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never
      }
    };
    const authCtx = authCtxWithTeamRoles({});

    const result = toApiRelation(relationWithMetadata, authCtx, restrictedSchema);
    expect(result._externalMetadata?.note).toBeDefined();
    expect(result._externalMetadata?.secret).toBeUndefined();
  });
});
