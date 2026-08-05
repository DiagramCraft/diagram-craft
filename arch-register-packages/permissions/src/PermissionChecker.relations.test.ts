import { describe, expect, it } from 'vitest';
import { PermissionChecker } from './PermissionChecker.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';
import type { Relation, TeamRole } from './types.js';

const createRelation = (id: string, owner: string | null = null): Relation => ({
  id,
  workspace: 'workspace-1',
  owner,
  lifecycle: null
});

describe('PermissionChecker - Relation Permissions', () => {
  const checker = new PermissionChecker();

  it('global_admin gets all relation actions', () => {
    const relation = createRelation('relation-1');
    const context = buildAuthorizationContext({
      userId: 'admin',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(true);
    expect(checker.hasRelationPermission(context, relation, 'edit_relation')).toBe(true);
    expect(checker.hasRelationPermission(context, relation, 'admin_relation')).toBe(true);
  });

  it.each<{
    role: 'editor' | 'admin' | 'viewer';
    view: boolean;
    edit: boolean;
    admin: boolean;
  }>([
    { role: 'admin', view: true, edit: true, admin: false },
    { role: 'editor', view: true, edit: true, admin: false },
    { role: 'viewer', view: true, edit: false, admin: false }
  ])(
    '$role workspace role grants view=$view edit=$edit admin=$admin',
    ({ role, view, edit, admin }) => {
      const relation = createRelation('relation-1');
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: role,
        teamAssignments: [],
        teams: [],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(view);
      expect(checker.hasRelationPermission(context, relation, 'edit_relation')).toBe(edit);
      expect(checker.hasRelationPermission(context, relation, 'admin_relation')).toBe(admin);
    }
  );

  it('user with no workspace role and no owner-team membership has no relation actions', () => {
    const relation = createRelation('relation-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'nobody',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(false);
  });

  describe('direct owner-team relation actions vary by team role', () => {
    const relation = createRelation('relation-1', 'team-1');

    it.each<{ role: TeamRole; expected: string[] }>([
      { role: 'team_admin', expected: ['view_relation', 'edit_relation', 'admin_relation'] },
      { role: 'team_editor', expected: ['view_relation', 'edit_relation'] },
      { role: 'team_reviewer', expected: ['view_relation'] }
    ])('$role on owner team grants: $expected', ({ role, expected }) => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: null,
        teamAssignments: [{ teamId: 'team-1', role }],
        teams: [],
        schemas: [],
        entities: [],
        grants: []
      });

      const expectedSet = new Set(expected);
      expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(
        expectedSet.has('view_relation')
      );
      expect(checker.hasRelationPermission(context, relation, 'edit_relation')).toBe(
        expectedSet.has('edit_relation')
      );
      expect(checker.hasRelationPermission(context, relation, 'admin_relation')).toBe(
        expectedSet.has('admin_relation')
      );
    });
  });

  it('a subtree-scoped entity grant on an unrelated entity does not affect relation actions', () => {
    const relation = createRelation('relation-1');
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: [
        {
          id: 'grant-1',
          workspace: 'workspace-1',
          entity_id: 'some-entity',
          principal_type: 'user',
          principal_id: 'user-1',
          role: 'entity_admin',
          applies_to: 'subtree',
          created_at: new Date()
        }
      ]
    });

    // Entity grants have no relation analogue — must not leak into relation actions.
    expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(false);
  });

  it('applies a token capability ceiling to relation actions', () => {
    const relation = createRelation('relation-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'token-owner',
      globalRoles: [],
      workspaceRole: null,
      workspaceCapabilityCeiling: ['content.view'],
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(true);
    expect(checker.hasRelationPermission(context, relation, 'edit_relation')).toBe(false);
    expect(checker.hasRelationPermission(context, relation, 'admin_relation')).toBe(false);
  });

  it('relation with no owner gets no direct-owner actions, only workspace-role actions', () => {
    const relation = createRelation('relation-1', null);
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasRelationPermission(context, relation, 'view_relation')).toBe(false);
  });
});
