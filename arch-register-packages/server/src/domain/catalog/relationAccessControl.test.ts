import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from './db/catalogDatabase';
import {
  canEditTypedRelation,
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint,
  buildTypedRelationVisibilityPolicy
} from './relationAccessControl';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';

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
  it('fails closed for an unavailable endpoint schema for authenticated callers', () => {
    expect(canViewTypedRelationFromEndpoint(authCtx(null), null, 'relation-schema-1', 'out')).toBe(
      false
    );
  });

  it('preserves the system bypass for an unavailable endpoint schema', () => {
    expect(canViewTypedRelationFromEndpoint(null, null, 'relation-schema-1', 'out')).toBe(true);
    expect(
      canEditTypedRelation(null, [{ schema: null, direction: 'out' }], 'relation-schema-1')
    ).toBe(true);
  });

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

  it('fails closed for malformed typed-relation owner metadata', () => {
    const malformedSchema: FieldGroupSchemaShape = {
      fields: [
        {
          id: 'malformed-relation',
          name: 'Malformed relation',
          type: 'typedRelation',
          relationSchemaId: 42,
          direction: 'sideways'
        }
      ],
      groups: []
    };

    expect(
      canViewTypedRelationFromEndpoint(authCtx(null), malformedSchema, 'relation-schema-1', 'out')
    ).toBe(false);
    expect(
      canViewTypedRelationFromEndpoint(null, malformedSchema, 'relation-schema-1', 'out')
    ).toBe(true);
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

  it('fails closed when a missing endpoint is paired with a known unbound endpoint', () => {
    expect(
      canViewTypedRelation(
        authCtx(null),
        [
          { schema: null, direction: 'out' },
          { schema: schema(), direction: 'in' }
        ],
        'relation-schema-1'
      )
    ).toBe(false);
  });

  it('checks endpoint availability before relation-owner overrides', () => {
    const teamAdmin = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-owner', role: 'team_admin' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(
      canViewTypedRelation(
        teamAdmin,
        [
          { schema: null, direction: 'out' },
          { schema: schema(), direction: 'in' }
        ],
        'relation-schema-1',
        'team-owner'
      )
    ).toBe(false);
  });
});

describe('relation owner composition (#2708)', () => {
  it('compiles endpoint visibility and relation-owner overrides into a query policy', () => {
    const policy = buildTypedRelationVisibilityPolicy(
      authCtx(null),
      [schema('restricted')],
      [{ id: 'relation-schema-1' }]
    );

    expect(policy).toEqual({
      entitySchemaIds: ['schema-1'],
      endpointScopes: [
        {
          relationSchemaId: 'relation-schema-1',
          inEntitySchemaIds: ['schema-1'],
          outEntitySchemaIds: []
        }
      ],
      ownerIds: [],
      allOwners: false
    });
  });

  it('includes owner teams that can view relations in the SQL policy', () => {
    const teamAdmin = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-owner', role: 'team_admin' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(
      buildTypedRelationVisibilityPolicy(
        teamAdmin,
        [schema('restricted')],
        [{ id: 'relation-schema-1' }]
      )?.ownerIds
    ).toEqual(['team-owner']);
  });

  it('grants edit to a relation owner-team admin even when the endpoint field is restricted', () => {
    const teamAdmin = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-owner', role: 'team_admin' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(
      canEditTypedRelation(
        teamAdmin,
        [{ schema: schema('restricted'), direction: 'out' }],
        'relation-schema-1',
        'team-owner'
      )
    ).toBe(true);
  });

  it('does not grant edit merely from generic ent.edit capability when neither owner nor endpoint access applies', () => {
    // Regression: composing with the full workspace-capability branch would make this true for
    // anyone with 'ent.edit', silently defeating the endpoint field-group restriction.
    const editorNotOwner = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'some-other-team', role: 'team_admin' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(
      canEditTypedRelation(
        editorNotOwner,
        [{ schema: schema('restricted'), direction: 'out' }],
        'relation-schema-1',
        'team-owner'
      )
    ).toBe(false);
  });

  it('a global admin can edit through owner composition regardless of the endpoint restriction', () => {
    const globalAdmin = buildAuthorizationContext({
      userId: 'admin',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(
      canEditTypedRelation(
        globalAdmin,
        [{ schema: schema('restricted'), direction: 'out' }],
        'relation-schema-1',
        null
      )
    ).toBe(true);
  });
});
