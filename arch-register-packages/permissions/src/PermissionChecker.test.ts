import { describe, it, expect } from 'vitest';
import { PermissionChecker } from './PermissionChecker.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';
import type { Entity, EntitySchema, EntityGrant, AuthorizationContext } from './types.js';

describe('PermissionChecker - Global Permissions', () => {
  const checker = new PermissionChecker();

  it('platform_admin has all global permissions', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'edit_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_teams')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_global_roles')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'view_audit')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'admin_platform')).toBe(true);
  });

  it('schema_admin can view and edit schemas', () => {
    const context = buildAuthorizationContext({
      userId: 'schema-admin',
      globalRoles: ['schema_admin'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'edit_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'view_audit')).toBe(false);
  });

  it('user_admin can manage users, teams, and roles', () => {
    const context = buildAuthorizationContext({
      userId: 'user-admin',
      globalRoles: ['user_admin'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_teams')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_global_roles')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'edit_schema')).toBe(false);
  });

  it('auditor can only view audit logs', () => {
    const context = buildAuthorizationContext({
      userId: 'auditor',
      globalRoles: ['auditor'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'view_audit')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(false);
  });

  it('user with multiple roles has combined permissions', () => {
    const context = buildAuthorizationContext({
      userId: 'multi-role-user',
      globalRoles: ['schema_admin', 'auditor'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'edit_schema')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'view_audit')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(false);
  });

  it('user with no roles has no permissions', () => {
    const context = buildAuthorizationContext({
      userId: 'regular-user',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasGlobalPermission(context, 'view_schema')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'edit_schema')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'manage_users')).toBe(false);
    expect(checker.hasGlobalPermission(context, 'view_audit')).toBe(false);
  });
});

describe('PermissionChecker - Project Permissions', () => {
  const checker = new PermissionChecker();

  it('platform_admin can perform all project actions', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: ['team-1'],
      ownerOptions: [],
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
      teamMemberships: ['team-2'],
      ownerOptions: [],
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
      teamMemberships: ['team-1', 'team-2', 'team-3'],
      ownerOptions: [],
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
      teamMemberships: ['team-1'],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, null, 'edit_project')).toBe(false);
  });

  it('platform_admin can access project with null owner', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(checker.hasProjectPermission(context, null, 'edit_project')).toBe(true);
  });
});

describe('PermissionChecker - Entity Permissions with Public Visibility', () => {
  const checker = new PermissionChecker();

  const createPublicEntity = (id: string, owner: string | null = null): Entity => ({
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
    visibility_mode: 'public',
    created_at: new Date(),
    updated_at: new Date()
  });

  it('anyone can view public entities', () => {
    const entity = createPublicEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
  });

  it('public visibility does not grant edit permission', () => {
    const entity = createPublicEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(false);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(false);
  });

  it('platform_admin has all permissions on public entities', () => {
    const entity = createPublicEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
  });

  it('owner team member has entity_admin role on public entity', () => {
    const entity = createPublicEntity('entity-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'team-member',
      globalRoles: [],
      teamMemberships: ['team-1'],
      ownerOptions: [],
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

describe('PermissionChecker - Entity Permissions with Restricted Visibility', () => {
  const checker = new PermissionChecker();

  const createRestrictedEntity = (id: string, owner: string | null = null): Entity => ({
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
    visibility_mode: 'restricted',
    created_at: new Date(),
    updated_at: new Date()
  });

  it('user without grants cannot view restricted entity', () => {
    const entity = createRestrictedEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(false);
  });

  it('owner team member has full access to restricted entity', () => {
    const entity = createRestrictedEntity('entity-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'team-member',
      globalRoles: [],
      teamMemberships: ['team-1'],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: []
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
  });

  it('platform_admin has full access to restricted entity', () => {
    const entity = createRestrictedEntity('entity-1');
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [],
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
    visibility_mode: 'restricted',
    created_at: new Date(),
    updated_at: new Date()
  });

  const createGrant = (
    entityId: string,
    userId: string,
    role: 'viewer' | 'editor' | 'contributor' | 'entity_admin',
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

  it('viewer role grants only view permission', () => {
    const entity = createEntity('entity-1');
    const grant = createGrant('entity-1', 'user-1', 'viewer');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(false);
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(false);
  });

  it('editor role grants view and edit permissions', () => {
    const entity = createEntity('entity-1');
    const grant = createGrant('entity-1', 'user-1', 'editor');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
    const viewerGrant = createGrant('entity-1', 'user-1', 'viewer');
    const editorGrant = createGrant('entity-1', 'user-1', 'editor');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: [viewerGrant, editorGrant]
    });

    // Should have editor permissions (union of viewer + editor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
  });

  it('grant on different entity does not apply', () => {
    const entity1 = createEntity('entity-1');
    const entity2 = createEntity('entity-2');
    const grant = createGrant('entity-1', 'user-1', 'entity_admin');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [],
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
    visibility_mode: 'restricted',
    created_at: new Date(),
    updated_at: new Date()
  });

  const createTeamGrant = (
    entityId: string,
    teamId: string,
    role: 'viewer' | 'editor' | 'contributor' | 'entity_admin',
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
      teamMemberships: ['team-1'],
      ownerOptions: [],
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
      teamMemberships: ['team-2'],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(false);
  });

  it('user in multiple teams gets combined permissions', () => {
    const entity = createEntity('entity-1');
    const team1Grant = createTeamGrant('entity-1', 'team-1', 'viewer');
    const team2Grant = createTeamGrant('entity-1', 'team-2', 'editor');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: ['team-1', 'team-2'],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: [team1Grant, team2Grant]
    });

    // Should have editor permissions (union of viewer + editor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
  });

  it('direct user grant and team grant combine', () => {
    const entity = createEntity('entity-1');
    const userGrant: EntityGrant = {
      id: 'grant-user',
      workspace: 'workspace-1',
      entity_id: 'entity-1',
      principal_type: 'user',
      principal_id: 'user-1',
      role: 'viewer',
      applies_to: 'self',
      created_at: new Date()
    };
    const teamGrant = createTeamGrant('entity-1', 'team-1', 'contributor');
    
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: ['team-1'],
      ownerOptions: [],
      schemas: [],
      entities: [entity],
      grants: [userGrant, teamGrant]
    });

    // Should have contributor permissions (union of viewer + contributor)
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
  });
});
