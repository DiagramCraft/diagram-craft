import { describe, it, expect } from 'vitest';
import { PermissionChecker } from './PermissionChecker.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';
import type { Entity, EntitySchema, EntityGrant } from './types.js';

describe('PermissionChecker - Subtree Grants', () => {
  const checker = new PermissionChecker();

  // Helper to create a schema with containment field
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
        maxCount: 1
      }
    ],
    color: null,
    icon: null,
    default_owner: null,
    created_at: new Date(),
    updated_at: new Date()
  });

  // Helper to create entity with parent reference
  const createEntity = (id: string, parentId: string | null = null): Entity => ({
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
    data: parentId ? { parent: parentId } : {},
    visibility_mode: 'restricted',
    created_at: new Date(),
    updated_at: new Date()
  });

  const createGrant = (
    entityId: string,
    userId: string,
    role: 'editor' | 'contributor' | 'entity_admin',
    scope: 'self' | 'subtree'
  ): EntityGrant => ({
    id: `grant-${entityId}-${userId}-${scope}`,
    workspace: 'workspace-1',
    entity_id: entityId,
    principal_type: 'user',
    principal_id: userId,
    role,
    applies_to: scope,
    created_at: new Date()
  });

  it('self-scoped grant only applies to the specific entity', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent');
    const child = createEntity('child', 'parent');
    const grant = createGrant('parent', 'user-1', 'editor', 'self');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(false);
  });

  it('subtree-scoped grant applies to entity and direct children', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent');
    const child = createEntity('child', 'parent');
    const grant = createGrant('parent', 'user-1', 'editor', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
  });

  it('subtree-scoped grant applies to deeply nested descendants', () => {
    const schema = createSchema('schema-1');
    const root = createEntity('root');
    const level1 = createEntity('level1', 'root');
    const level2 = createEntity('level2', 'level1');
    const level3 = createEntity('level3', 'level2');
    const grant = createGrant('root', 'user-1', 'editor', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [root, level1, level2, level3],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, root, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, root, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level1, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level1, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level2, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level2, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level3, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level3, 'edit_entity')).toBe(true);
  });

  it('subtree grant does not apply to sibling entities', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent');
    const child1 = createEntity('child1', 'parent');
    const child2 = createEntity('child2', 'parent');
    const grant = createGrant('child1', 'user-1', 'editor', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child1, child2],
      grants: [grant]
    });

    expect(checker.hasEntityPermission(context, child1, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child2, 'view_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(false);
  });

  it('multiple subtree grants at different levels combine', () => {
    const schema = createSchema('schema-1');
    const root = createEntity('root');
    const level1 = createEntity('level1', 'root');
    const level2 = createEntity('level2', 'level1');

    const rootGrant = createGrant('root', 'user-1', 'editor', 'subtree');
    const level1Grant = createGrant('level1', 'user-1', 'contributor', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [root, level1, level2],
      grants: [rootGrant, level1Grant]
    });

    // Root has editor permissions only (no create_child)
    expect(checker.hasEntityPermission(context, root, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, root, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, root, 'create_child')).toBe(false);

    // Level1 has both editor (from root) and contributor (direct) = contributor
    expect(checker.hasEntityPermission(context, level1, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level1, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level1, 'create_child')).toBe(true);

    // Level2 has both editor (from root) and contributor (from level1) = contributor
    expect(checker.hasEntityPermission(context, level2, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level2, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level2, 'create_child')).toBe(true);
  });

  it('subtree grant with entity_admin role grants admin to all descendants', () => {
    const schema = createSchema('schema-1');
    const root = createEntity('root');
    const child = createEntity('child', 'root');
    const grandchild = createEntity('grandchild', 'child');
    const grant = createGrant('root', 'user-1', 'entity_admin', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [root, child, grandchild],
      grants: [grant]
    });

    // All entities should have full admin permissions
    for (const entity of [root, child, grandchild]) {
      expect(checker.hasEntityPermission(context, entity, 'view_entity')).toBe(true);
      expect(checker.hasEntityPermission(context, entity, 'edit_entity')).toBe(true);
      expect(checker.hasEntityPermission(context, entity, 'create_child')).toBe(true);
      expect(checker.hasEntityPermission(context, entity, 'admin_entity')).toBe(true);
    }
  });

  it('entity with multiple parents inherits from all subtree grants', () => {
    const schema: EntitySchema = {
      id: 'schema-1',
      workspace: 'workspace-1',
      name: 'Schema 1',
      fields: [
        {
          id: 'parent_a',
          name: 'Parent A',
          type: 'containment',
          schemaId: 'schema-1',
          minCount: 0,
          maxCount: 1
        },
        {
          id: 'parent_b',
          name: 'Parent B',
          type: 'containment',
          schemaId: 'schema-1',
          minCount: 0,
          maxCount: 1
        }
      ],
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const parent1 = createEntity('parent1');
    const parent2 = createEntity('parent2');
    const child: Entity = {
      ...createEntity('child'),
      data: { parent_a: ['parent1'], parent_b: ['parent2'] }
    };

    const grant1 = createGrant('parent1', 'user-1', 'editor', 'subtree');
    const grant2 = createGrant('parent2', 'user-1', 'contributor', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent1, parent2, child],
      grants: [grant1, grant2]
    });

    // Child should have contributor permissions (union of editor + contributor)
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'edit_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'create_child')).toBe(true);
  });

  it('subtree grant does not apply to unrelated entity hierarchy', () => {
    const schema = createSchema('schema-1');
    const tree1Root = createEntity('tree1-root');
    const tree1Child = createEntity('tree1-child', 'tree1-root');
    const tree2Root = createEntity('tree2-root');
    const tree2Child = createEntity('tree2-child', 'tree2-root');

    const grant = createGrant('tree1-root', 'user-1', 'entity_admin', 'subtree');

    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [tree1Root, tree1Child, tree2Root, tree2Child],
      grants: [grant]
    });

    // Tree 1 entities have permissions
    expect(checker.hasEntityPermission(context, tree1Root, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, tree1Child, 'view_entity')).toBe(true);

    // Tree 2 entities do not have permissions
    expect(checker.hasEntityPermission(context, tree2Root, 'view_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, tree2Child, 'view_entity')).toBe(false);
  });
});

describe('PermissionChecker - Visibility Inheritance', () => {
  const checker = new PermissionChecker();

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
        maxCount: 1
      }
    ],
    color: null,
    icon: null,
    default_owner: null,
    created_at: new Date(),
    updated_at: new Date()
  });

  const createEntity = (
    id: string,
    parentId: string | null = null,
    visibility: 'public' | 'restricted' | null = null
  ): Entity => ({
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
    data: parentId ? { parent: parentId } : {},
    visibility_mode: visibility,
    created_at: new Date(),
    updated_at: new Date()
  });

  it('child without visibility inherits public from parent', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent', null, 'public');
    const child = createEntity('child', 'parent', null);

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: []
    });

    // Both should be viewable (child inherits public visibility)
    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(true);
  });

  it('child without visibility inherits restricted from parent', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent', null, 'restricted');
    const child = createEntity('child', 'parent', null);

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: []
    });

    // Neither should be viewable (child inherits restricted visibility)
    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(false);
  });

  it('child explicit visibility overrides parent', () => {
    const schema = createSchema('schema-1');
    const parent = createEntity('parent', null, 'public');
    const child = createEntity('child', 'parent', 'restricted');

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [parent, child],
      grants: []
    });

    // Parent is public, child is restricted
    expect(checker.hasEntityPermission(context, parent, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, child, 'view_entity')).toBe(false);
  });

  it('deeply nested entity inherits from first ancestor with visibility', () => {
    const schema = createSchema('schema-1');
    const root = createEntity('root', null, 'public');
    const level1 = createEntity('level1', 'root', null);
    const level2 = createEntity('level2', 'level1', null);
    const level3 = createEntity('level3', 'level2', null);

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [root, level1, level2, level3],
      grants: []
    });

    // All should inherit public visibility from root
    expect(checker.hasEntityPermission(context, root, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level1, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level2, 'view_entity')).toBe(true);
    expect(checker.hasEntityPermission(context, level3, 'view_entity')).toBe(true);
  });

  it('entity without visibility and no ancestors defaults to public', () => {
    const schema = createSchema('schema-1');
    const orphan = createEntity('orphan', null, null);

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [orphan],
      grants: []
    });

    // Should default to public
    expect(checker.hasEntityPermission(context, orphan, 'view_entity')).toBe(true);
  });

  it('visibility inheritance stops at first explicit visibility in chain', () => {
    const schema = createSchema('schema-1');
    const root = createEntity('root', null, 'restricted');
    const level1 = createEntity('level1', 'root', null);
    const level2 = createEntity('level2', 'level1', 'public');
    const level3 = createEntity('level3', 'level2', null);

    const context = buildAuthorizationContext({
      userId: 'any-user',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [root, level1, level2, level3],
      grants: []
    });

    // Root and level1 are restricted
    expect(checker.hasEntityPermission(context, root, 'view_entity')).toBe(false);
    expect(checker.hasEntityPermission(context, level1, 'view_entity')).toBe(false);

    // Level2 is explicitly public
    expect(checker.hasEntityPermission(context, level2, 'view_entity')).toBe(true);

    // Level3 inherits public from level2
    expect(checker.hasEntityPermission(context, level3, 'view_entity')).toBe(true);
  });
});
