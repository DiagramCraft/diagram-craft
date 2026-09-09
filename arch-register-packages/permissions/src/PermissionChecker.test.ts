import { describe, expect, it } from 'vitest';
import { PermissionChecker } from './PermissionChecker.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';
import type { Entity, EntityGrant } from './types.js';

const teamAssignments = (...teamIds: string[]) =>
  teamIds.map(teamId => ({ teamId, role: 'team_admin' as const }));

describe('PermissionChecker - Global Permissions', () => {
  const checker = new PermissionChecker();

  it('supports teamAssignments and teams as the primary context shape', () => {
    const context = buildAuthorizationContext({
      userId: 'team-admin',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(true);
  });

  it('global_admin has all global permissions', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'admin_platform')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'create_workspaces')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
  });

  it('workspace_admin can create workspaces and manage workspace roles', () => {
    const context = buildAuthorizationContext({
      userId: 'workspace-admin',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'create_workspaces')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'admin_platform')).toBe(false);
  });

  it('user with no roles has no permissions', () => {
    const context = buildAuthorizationContext({
      userId: 'regular-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2', 'team-3'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'admin_platform')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'create_workspaces')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(false);
  });
});

describe('PermissionChecker - Application Access', () => {
  const checker = new PermissionChecker();

  const contextFor = (options: {
    userId?: string;
    globalRoles?: Array<'global_admin' | 'workspace_admin'>;
    workspaceRole?: string | null;
    teamIds?: string[];
  }) =>
    buildAuthorizationContext({
      userId: options.userId ?? 'member-1',
      globalRoles: options.globalRoles ?? [],
      workspaceRole: options.workspaceRole === undefined ? 'viewer' : options.workspaceRole,
      workspaceRoles: [
        {
          id: 'viewer',
          name: 'Viewer',
          description: '',
          tone: 'blue',
          builtin: true,
          capabilities: ['ws.view']
        },
        {
          id: 'role-manager',
          name: 'Role manager',
          description: '',
          tone: 'blue',
          builtin: false,
          capabilities: ['ws.view', 'people.role']
        }
      ],
      teamAssignments: (options.teamIds ?? []).map(teamId => ({
        teamId,
        role: 'team_reviewer' as const
      })),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

  it('denies ordinary members when no policy exists', () => {
    expect(checker.hasApplicationAccess(contextFor({}), null)).toBe(false);
  });

  it('allows all workspace members for an all-member policy', () => {
    expect(
      checker.hasApplicationAccess(contextFor({}), {
        mode: 'all_members',
        userIds: [],
        teamIds: []
      })
    ).toBe(true);
  });

  it('matches selected users and teams additively', () => {
    const context = contextFor({ teamIds: ['team-1'] });
    expect(
      checker.hasApplicationAccess(context, {
        mode: 'selected',
        userIds: ['member-1'],
        teamIds: []
      })
    ).toBe(true);
    expect(
      checker.hasApplicationAccess(contextFor({ userId: 'member-2', teamIds: ['team-1'] }), {
        mode: 'selected',
        userIds: ['member-1'],
        teamIds: ['team-1']
      })
    ).toBe(true);
  });

  it('requires workspace view for ordinary selected users', () => {
    expect(
      checker.hasApplicationAccess(contextFor({ workspaceRole: null, userId: 'member-1' }), {
        mode: 'selected',
        userIds: ['member-1'],
        teamIds: []
      })
    ).toBe(false);
  });

  it('lets global administrators and role managers bypass the policy', () => {
    expect(
      checker.hasApplicationAccess(
        contextFor({ globalRoles: ['global_admin'], workspaceRole: null }),
        null
      )
    ).toBe(true);
    expect(checker.hasApplicationAccess(contextFor({ workspaceRole: 'role-manager' }), null)).toBe(
      true
    );
  });
});

describe('PermissionChecker - Project Permissions', () => {
  const checker = new PermissionChecker();

  it('global_admin can perform all project actions', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2', 'team-3'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-1', 'delete_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-1', 'manage_files')).toBe(true);
  });

  it('team member can perform all project actions on their team projects', () => {
    const context = buildAuthorizationContext({
      userId: 'team-member',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-1', 'delete_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-1', 'manage_files')).toBe(true);
  });

  it('non-team member cannot perform project actions', () => {
    const context = buildAuthorizationContext({
      userId: 'other-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(false);
    expect(checker.hasProjectPermission(context, 'team-1', 'delete_project')).toBe(false);
    expect(checker.hasProjectPermission(context, 'team-1', 'manage_files')).toBe(false);
  });

  it('user in multiple teams can access projects from all teams', () => {
    const context = buildAuthorizationContext({
      userId: 'multi-team-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2', 'team-3'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-2', 'edit_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-3', 'edit_project')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-4', 'edit_project')).toBe(false);
  });

  it('project with null owner cannot be accessed by regular users', () => {
    const context = buildAuthorizationContext({
      userId: 'regular-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, null, 'edit_project')).toBe(false);
  });

  it('global_admin can access project with null owner', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, null, 'edit_project')).toBe(true);
  });
});

describe('PermissionChecker - Entity Permissions without Workspace-wide View', () => {
  const checker = new PermissionChecker();

  const createUnownedEntity = (id: string, owner: string | null = null): Entity => ({
    id,
    workspace: 'workspace-1',
    slug: `entity-${id}`,
    namespace: 'default',
    name: `Entity ${id}`,
    description: 'Test entity',
    owner,
    lifecycle: null,
    tags: [],
    links: [],
    schema_id: 'schema-1',
    data: {},
    created_at: new Date(),
    updated_at: new Date()
  });

  it('user without content.view, ownership, or grants cannot view entity', () => {
    const entity = createUnownedEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(false);
  });

  it('owner team member has full access to entity', () => {
    const entity = createUnownedEntity('entity-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'team-member',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
  });

  it('global_admin has full access to entity', () => {
    const entity = createUnownedEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
  });
});

describe('PermissionChecker - Entity Grants with Direct User Assignment', () => {
  const checker = new PermissionChecker();

  const createEntity = (id: string): Entity => ({
    id,
    workspace: 'workspace-1',
    slug: `entity-${id}`,
    namespace: 'default',
    name: `Entity ${id}`,
    description: 'Test entity',
    owner: null,
    lifecycle: null,
    tags: [],
    links: [],
    schema_id: 'schema-1',
    data: {},
    created_at: new Date(),
    updated_at: new Date()
  });

  const createGrant = (
    entityId: string,
    userId: string,
    role: 'editor' | 'contributor' | 'entity_admin',
    scope: 'self' | 'subtree' = 'self'
  ): EntityGrant => ({
    id: `grant-${entityId}-${userId}`,
    workspace: 'workspace-1',
    entity_id: entityId,
    principal_type: 'user',
    principal_id: userId,
    role,
    applies_to: scope,
    created_at: new Date()
  });

  it('editor role grants view and edit permissions', () => {
    const entity = createEntity('entity-1');
    const grant = createGrant('entity-1', 'user-1', 'editor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(false);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(false);
  });

  it('contributor role grants view, edit, and create_child permissions', () => {
    const entity = createEntity('entity-1');
    const grant = createGrant('entity-1', 'user-1', 'contributor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(false);
  });

  it('entity_admin role grants all permissions', () => {
    const entity = createEntity('entity-1');
    const grant = createGrant('entity-1', 'user-1', 'entity_admin');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
  });

  it('multiple grants combine permissions (union)', () => {
    const entity = createEntity('entity-1');
    const editorGrant = createGrant('entity-1', 'user-1', 'editor');
    const contributorGrant = createGrant('entity-1', 'user-1', 'contributor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [editorGrant, contributorGrant]
    });

    // Should have contributor permissions (union of editor + contributor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
  });

  it('grant on different entity does not apply', () => {
    const entity1 = createEntity('entity-1');
    const entity2 = createEntity('entity-2');
    const grant = createGrant('entity-1', 'user-1', 'entity_admin');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2'),
      teams: [],
      schemas: [],
      entities: [entity1, entity2],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity1, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity2, 'view_entity')).toBe(false);
  });
});

describe('PermissionChecker - Entity Grants with Team Assignment', () => {
  const checker = new PermissionChecker();

  const createEntity = (id: string): Entity => ({
    id,
    workspace: 'workspace-1',
    slug: `entity-${id}`,
    namespace: 'default',
    name: `Entity ${id}`,
    description: 'Test entity',
    owner: null,
    lifecycle: null,
    tags: [],
    links: [],
    schema_id: 'schema-1',
    data: {},
    created_at: new Date(),
    updated_at: new Date()
  });

  const createTeamGrant = (
    entityId: string,
    teamId: string,
    role: 'editor' | 'contributor' | 'entity_admin',
    scope: 'self' | 'subtree' = 'self'
  ): EntityGrant => ({
    id: `grant-${entityId}-${teamId}`,
    workspace: 'workspace-1',
    entity_id: entityId,
    principal_type: 'team',
    principal_id: teamId,
    role,
    applies_to: scope,
    created_at: new Date()
  });

  it('team member inherits permissions from team grant', () => {
    const entity = createEntity('entity-1');
    const grant = createTeamGrant('entity-1', 'team-1', 'editor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
  });

  it('non-team member does not inherit team grant', () => {
    const entity = createEntity('entity-1');
    const grant = createTeamGrant('entity-1', 'team-1', 'editor');

    const context = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(false);
  });

  it('user in multiple teams gets combined permissions', () => {
    const entity = createEntity('entity-1');
    const team1Grant = createTeamGrant('entity-1', 'team-1', 'editor');
    const team2Grant = createTeamGrant('entity-1', 'team-2', 'contributor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1', 'team-2'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [team1Grant, team2Grant]
    });

    // Should have contributor permissions (union of editor + contributor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
  });

  it('direct user grant and team grant combine', () => {
    const entity = createEntity('entity-1');
    const userGrant: EntityGrant = {
      id: 'grant-user',
      workspace: 'workspace-1',
      entity_id: 'entity-1',
      principal_type: 'user',
      principal_id: 'user-1',
      role: 'editor',
      applies_to: 'self',
      created_at: new Date()
    };
    const teamGrant = createTeamGrant('entity-1', 'team-1', 'contributor');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: teamAssignments('team-1'),
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [userGrant, teamGrant]
    });

    // Should have contributor permissions (union of editor + contributor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
  });
});
