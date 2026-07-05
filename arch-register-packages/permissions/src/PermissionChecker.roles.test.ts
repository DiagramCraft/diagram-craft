import { describe, expect, it } from 'vitest';
import { PermissionChecker } from './PermissionChecker.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';
import {
  WORKSPACE_ROLE_CAPABILITIES,
  TEAM_ROLE_PERMISSIONS,
} from './constants.js';
import type {
  BuiltinWorkspaceRole,
  Entity,
  EntitySchema,
  TeamRole,
  WorkspaceCapability,
} from './types.js';

const ALL_WORKSPACE_ROLES: BuiltinWorkspaceRole[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

const ALL_CAPABILITIES: WorkspaceCapability[] = [
  'ws.view', 'ws.settings', 'ws.delete', 'ws.audit',
  'people.invite', 'people.role', 'people.remove', 'people.teams',
  'proj.create', 'proj.edit', 'content.view', 'content.edit', 'ent.edit', 'ent.propose', 'comments', 'export',
  'schema.edit', 'schema.publish',
];

const createSchema = (id: string): EntitySchema => ({
  id,
  workspace: 'workspace-1',
  name: `Schema ${id}`,
  fields: [
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: id,
      minCount: 0,
      maxCount: 1,
    },
  ],
  color: null,
  icon: null,
  default_owner: null,
  created_at: new Date(),
  updated_at: new Date(),
});

const createEntity = (
  id: string,
  owner: string | null = null,
  parentId: string | null = null,
): Entity => ({
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
  data: parentId ? { parent: parentId } : {},
  visibility_mode: 'restricted',
  created_at: new Date(),
  updated_at: new Date(),
});

// ── Workspace Role Capabilities ───────────────────────────────────

describe('PermissionChecker - Workspace Role Capabilities', () => {
  const checker = new PermissionChecker();

  it.each(ALL_WORKSPACE_ROLES)(
    '%s role grants exactly the expected capabilities',
    (role) => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: role,
        teamAssignments: [],
        teams: [],
        schemas: [],
        entities: [],
        grants: [],
      });

      const expected = new Set(WORKSPACE_ROLE_CAPABILITIES[role]);

      for (const cap of ALL_CAPABILITIES) {
        expect(checker.hasWorkspaceCapability(context, cap)).toBe(
          expected.has(cap),
        );
      }
    },
  );

  it('global_admin implicitly has all workspace capabilities', () => {
    const context = buildAuthorizationContext({
      userId: 'admin',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: [],
    });

    for (const cap of ALL_CAPABILITIES) {
      expect(checker.hasWorkspaceCapability(context, cap)).toBe(true);
    }
  });

  it('user with no workspace role and no global role has no capabilities', () => {
    const context = buildAuthorizationContext({
      userId: 'nobody',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: [],
    });

    for (const cap of ALL_CAPABILITIES) {
      expect(checker.hasWorkspaceCapability(context, cap)).toBe(false);
    }
  });

  it('workspace_admin global role does not grant workspace capabilities', () => {
    const context = buildAuthorizationContext({
      userId: 'ws-admin',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: [],
    });

    for (const cap of ALL_CAPABILITIES) {
      expect(checker.hasWorkspaceCapability(context, cap)).toBe(false);
    }
  });
});

// ── Team Role Differentiation ─────────────────────────────────────

describe('PermissionChecker - Team Role Differentiation', () => {
  const checker = new PermissionChecker();

  describe('entity permissions vary by team role', () => {
    const entity = createEntity('entity-1', 'team-1');

    it.each<{ role: TeamRole; expected: string[] }>([
      {
        role: 'team_admin',
        expected: ['view_entity', 'edit_entity', 'create_child', 'admin_entity'],
      },
      {
        role: 'team_editor',
        expected: ['view_entity', 'edit_entity', 'create_child'],
      },
      {
        role: 'team_reviewer',
        expected: ['view_entity'],
      },
    ])(
      '$role on owner team grants direct actions: $expected',
      ({ role, expected }) => {
        const context = buildAuthorizationContext({
          userId: 'user-1',
          globalRoles: [],
          workspaceRole: null,
          teamAssignments: [{ teamId: 'team-1', role }],
          teams: [],
          schemas: [],
          entities: [entity],
          grants: [],
        });

        const expectedSet = new Set(expected);
        expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(
          expectedSet.has('view_entity'),
        );
        expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(
          expectedSet.has('edit_entity'),
        );
        expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(
          expectedSet.has('create_child'),
        );
        expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(
          expectedSet.has('admin_entity'),
        );
      },
    );
  });

  describe('project permissions vary by team role', () => {
    it.each<{ role: TeamRole; edit: boolean; delete_: boolean; files: boolean }>([
      { role: 'team_admin', edit: true, delete_: true, files: true },
      { role: 'team_editor', edit: true, delete_: false, files: true },
      { role: 'team_reviewer', edit: false, delete_: false, files: false },
    ])(
      '$role grants edit=$edit, delete=$delete_, manage_files=$files',
      ({ role, edit, delete_, files }) => {
        const context = buildAuthorizationContext({
          userId: 'user-1',
          globalRoles: [],
          workspaceRole: null,
          teamAssignments: [{ teamId: 'team-1', role }],
          teams: [],
          schemas: [],
          entities: [],
          grants: [],
        });

        expect(checker.hasProjectPermission(context, 'team-1', 'edit_project')).toBe(edit);
        expect(checker.hasProjectPermission(context, 'team-1', 'delete_project')).toBe(delete_);
        expect(checker.hasProjectPermission(context, 'team-1', 'manage_files')).toBe(files);
      },
    );
  });

  it('user with multiple team roles on same team gets the union', () => {
    const entity = createEntity('entity-1', 'team-1');
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [
        { teamId: 'team-1', role: 'team_reviewer' },
        { teamId: 'team-1', role: 'team_editor' },
      ],
      teams: [],
      schemas: [],
      entities: [entity],
      grants: [],
    });

    // team_editor direct: view, edit, create_child
    expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
    // admin_entity only comes from team_admin
    expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(false);
  });
});

// ── Descendant Entity Actions via Ancestor Owner Teams ────────────

describe('PermissionChecker - Descendant Entity Actions', () => {
  const checker = new PermissionChecker();
  const schema = createSchema('schema-1');

  it('team_admin on ancestor grants contributor descendant actions', () => {
    const parent = createEntity('parent', 'team-1');
    const child = createEntity('child', null, 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    const descendantActions = TEAM_ROLE_PERMISSIONS['team_admin'].descendantEntityActions;
    expect(descendantActions).toContain('view_entity');
    expect(descendantActions).toContain('edit_entity');
    expect(descendantActions).toContain('create_child');

    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'create_child')).toBe(true);
    // admin_entity is NOT granted as a descendant action
    expect(checker.hasEntityPermission(context, child, 'admin_entity')).toBe(false);
  });

  it('team_editor on ancestor grants editor descendant actions', () => {
    const parent = createEntity('parent', 'team-1');
    const child = createEntity('child', null, 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_editor' }],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'edit_entity')).toBe(true);
    // create_child is NOT in editor descendant actions
    expect(checker.hasEntityPermission(context, child, 'create_child')).toBe(false);
    expect(checker.hasEntityPermission(context, child, 'admin_entity')).toBe(false);
  });

  it('team_reviewer on ancestor grants viewer descendant actions', () => {
    const parent = createEntity('parent', 'team-1');
    const child = createEntity('child', null, 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_reviewer' }],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'edit_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, child, 'create_child')).toBe(false);
    expect(checker.hasEntityPermission(context, child, 'admin_entity')).toBe(false);
  });

  it('descendant actions propagate through multiple levels', () => {
    const root = createEntity('root', 'team-1');
    const mid = createEntity('mid', null, 'root');
    const leaf = createEntity('leaf', null, 'mid');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [],
      schemas: [schema],
      entities: [root, mid, leaf],
      grants: [],
    });

    // root gets direct actions (entity_admin level)
    expect(checker.hasEntityPermission(context, root, 'admin_entity')).toBe(true);

    // mid and leaf get descendant actions (contributor level)
    expect(checker.hasEntityPermission(context, mid, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, mid, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, mid, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, mid, 'admin_entity')).toBe(false);

    expect(checker.hasEntityPermission(context, leaf, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, leaf, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, leaf, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, leaf, 'admin_entity')).toBe(false);
  });

  it('direct owner team actions take precedence over ancestor descendant actions', () => {
    const parent = createEntity('parent', 'team-1');
    // child is directly owned by team-1 as well
    const child = createEntity('child', 'team-1', 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    // child gets DIRECT actions (entity_admin), not just descendant (contributor)
    expect(checker.hasEntityPermission(context, child, 'admin_entity')).toBe(true);
  });

  it('different teams on parent and child combine actions', () => {
    const parent = createEntity('parent', 'team-1');
    const child = createEntity('child', 'team-2', 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [
        { teamId: 'team-1', role: 'team_reviewer' },
        { teamId: 'team-2', role: 'team_editor' },
      ],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    // child gets:
    //  - direct from team-2 team_editor: view, edit, create_child
    //  - descendant from team-1 team_reviewer: view
    // union: view, edit, create_child
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'create_child')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'admin_entity')).toBe(false);
  });

  it('no team membership on ancestor owner means no descendant actions', () => {
    const parent = createEntity('parent', 'team-1');
    const child = createEntity('child', null, 'parent');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-2', role: 'team_admin' }],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [],
    });

    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(false);
  });
});

// ── Combines global roles correctly ───────────────────────────────

describe('PermissionChecker - Multiple Global Roles', () => {
  const checker = new PermissionChecker();

  it('combines permissions from multiple global roles', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: ['global_admin', 'workspace_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: [],
    });

    expect(checker.hasGlobalPermission(context, 'admin_platform')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'create_workspaces')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
  });
});
