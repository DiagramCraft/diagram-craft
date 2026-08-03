import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from './db/catalogDatabase';
import {
  canEditTypedRelation,
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint
} from './relationAccessControl';

const schema = (groupId?: string): SchemaDbResult => ({
  id: 'schema-1',
  workspace: 'workspace-1',
  name: 'Schema',
  description: '',
  fields: [
    {
      id: 'relation',
      name: 'Relation',
      type: 'typedRelation',
      relationSchemaId: 'relation-schema-1',
      direction: 'out',
      requirementLevel: null,
      ...(groupId ? { groupId } : {})
    }
  ],
  groups: groupId
    ? [{ id: groupId, name: 'Restricted', accessControl: { teamIds: ['team-1'] } }]
    : [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SCH',
  created_at: new Date(),
  updated_at: new Date()
});

const authCtx = (role: 'team_editor' | 'team_reviewer' | null) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: role ? [{ teamId: 'team-1', role }] : [],
    schemas: [],
    entities: [],
    grants: []
  });

describe('typed relation owner-field access', () => {
  it('hides a relation when its only owner field is not viewable', () => {
    expect(
      canViewTypedRelationFromEndpoint(
        authCtx(null),
        schema('restricted'),
        'relation-schema-1',
        'out'
      )
    ).toBe(false);
  });

  it('allows a reviewer to view and prevents them from editing the owner field', () => {
    const reviewer = authCtx('team_reviewer');
    expect(
      canViewTypedRelation(
        reviewer,
        [{ schema: schema('restricted'), direction: 'out' }],
        'relation-schema-1'
      )
    ).toBe(true);
    expect(
      canEditTypedRelation(
        reviewer,
        [{ schema: schema('restricted'), direction: 'out' }],
        'relation-schema-1'
      )
    ).toBe(false);
  });

  it('uses any accessible owner binding for endpoint-agnostic access', () => {
    const viewer = authCtx(null);
    expect(
      canViewTypedRelation(
        viewer,
        [
          { schema: schema('restricted'), direction: 'out' },
          { schema: schema(), direction: 'in' }
        ],
        'relation-schema-1'
      )
    ).toBe(true);
  });
});
