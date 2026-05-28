import type {
  AuthorizationContext,
  Entity,
  EntityAction,
  EntityGrant,
  EntitySchema,
  GlobalPermission,
  GlobalRole,
  ProjectAction,
  VisibilityMode
} from './types.js';
import { decodeRefs } from './types.js';
import {
  GLOBAL_ROLE_PERMISSIONS,
  ROLE_ACTIONS,
  getGlobalPermissionsForRoles
} from './constants.js';

/**
 * Data provider interface for fetching permission-related data.
 * Implementations provide data from different sources (database, API, etc.)
 */
export interface PermissionDataProvider {
  /**
   * Fetch all entities in workspace (for relationship traversal)
   */
  getEntities(workspaceId: string): Promise<Entity[]>;

  /**
   * Fetch all schemas (for field definitions)
   */
  getSchemas(workspaceId: string): Promise<EntitySchema[]>;

  /**
   * Fetch entity grants for permission evaluation
   */
  getEntityGrants(workspaceId: string): Promise<EntityGrant[]>;

  /**
   * Fetch user's team memberships
   */
  getTeamMemberships(workspaceId: string, userId: string): Promise<string[]>;

  /**
   * Fetch user's global role assignments
   */
  getGlobalRoles(userId: string): Promise<GlobalRole[]>;
}

/**
 * Abstract base class for permission evaluation.
 * Implements shared permission logic that can be used by both server and web clients.
 */
export abstract class PermissionEvaluator {
  /**
   * Build authorization context by fetching all necessary data.
   * Must be implemented by concrete classes (server/web).
   */
  abstract buildContext(
    workspaceId: string,
    userId: string,
    dataProvider: PermissionDataProvider
  ): Promise<AuthorizationContext>;

  // ── Entity Permissions ────────────────────────────────────────

  /**
   * Check if user has a specific permission on an entity
   */
  hasEntityPermission(
    context: AuthorizationContext,
    entity: Entity,
    action: EntityAction
  ): boolean {
    const actions = this.getEntityActions(context, entity);
    return actions.has(action);
  }

  // ── Project Permissions ───────────────────────────────────────

  /**
   * Check if user has a specific permission on a project
   */
  hasProjectPermission(
    context: AuthorizationContext,
    ownerTeamId: string | null,
    _action: ProjectAction
  ): boolean {
    // Platform admins have all project permissions
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    // Team members of the owner team have all project permissions
    if (ownerTeamId != null && context.teamIds.has(ownerTeamId)) {
      return true;
    }

    // Note: Currently all project actions are treated equally.
    // Future enhancement: implement granular project permissions based on _action
    return false;
  }

  // ── Global Permissions ────────────────────────────────────────

  /**
   * Check if user has a global permission
   */
  hasGlobalPermission(context: AuthorizationContext, permission: GlobalPermission): boolean {
    return (
      context.globalPermissions.has(permission) || context.globalPermissions.has('admin_platform')
    );
  }

  // ── Protected Helper Methods ──────────────────────────────────

  /**
   * Get all entity actions available to the user for a specific entity
   */
  protected getEntityActions(context: AuthorizationContext, entity: Entity): Set<EntityAction> {
    const actions = new Set<EntityAction>();

    // 1. Check global roles for entity actions
    for (const role of context.globalRoles) {
      for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
        if (
          permission === 'view_entity' ||
          permission === 'edit_entity' ||
          permission === 'create_child' ||
          permission === 'admin_entity'
        ) {
          actions.add(permission);
        }
      }
    }

    // 2. Check visibility mode (public entities are viewable by all)
    if (this.resolveEntityVisibility(context, entity) === 'public') {
      actions.add('view_entity');
    }

    // 3. Check owner team membership (team owners get entity_admin role)
    if (entity.owner && context.teamIds.has(entity.owner)) {
      ROLE_ACTIONS['entity_admin'].forEach(action => actions.add(action));
    }

    // 4. Check entity grants
    const ancestorIds = this.collectAncestorIds(context, entity);
    for (const grant of context.grants) {
      const principalMatches =
        (grant.principal_type === 'user' && grant.principal_id === context.userId) ||
        (grant.principal_type === 'team' && context.teamIds.has(grant.principal_id));

      if (!principalMatches) continue;

      if (!this.hasApplicableGrant(grant, entity.id, ancestorIds)) continue;

      ROLE_ACTIONS[grant.role].forEach(action => actions.add(action));
    }

    return actions;
  }

  /**
   * Resolve the effective visibility mode for an entity by traversing up the containment hierarchy
   */
  protected resolveEntityVisibility(context: AuthorizationContext, entity: Entity): VisibilityMode {
    if (entity.visibility_mode) return entity.visibility_mode;

    const queue = [...this.getParentIds(entity, context.schemas.get(entity.schema_id))];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = context.entities.get(currentId);
      if (!current) continue;

      if (current.visibility_mode) return current.visibility_mode;

      queue.push(...this.getParentIds(current, context.schemas.get(current.schema_id)));
    }

    return 'public';
  }

  /**
   * Collect all ancestor entity IDs by traversing containment relationships
   */
  protected collectAncestorIds(context: AuthorizationContext, entity: Entity): Set<string> {
    const ancestorIds = new Set<string>();
    const queue = [...this.getParentIds(entity, context.schemas.get(entity.schema_id))];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (ancestorIds.has(currentId)) continue;
      ancestorIds.add(currentId);

      const current = context.entities.get(currentId);
      if (!current) continue;

      queue.push(...this.getParentIds(current, context.schemas.get(current.schema_id)));
    }

    return ancestorIds;
  }

  /**
   * Get parent entity IDs from containment fields
   */
  protected getParentIds(entity: Entity, schema: EntitySchema | undefined): string[] {
    if (!schema) return [];
    return schema.fields
      .filter(
        (field): field is Extract<EntitySchema['fields'][number], { type: 'containment' }> =>
          field.type === 'containment'
      )
      .flatMap(field => decodeRefs(entity.data[field.id]));
  }

  /**
   * Check if a grant applies to the target entity (either directly or via subtree)
   */
  protected hasApplicableGrant(
    grant: EntityGrant,
    targetEntityId: string,
    ancestorIds: Set<string>
  ): boolean {
    return (
      grant.entity_id === targetEntityId ||
      (grant.applies_to === 'subtree' && ancestorIds.has(grant.entity_id))
    );
  }

  /**
   * Helper to build authorization context from fetched data
   */
  protected buildAuthorizationContextFromData(
    userId: string,
    globalRoles: string[],
    teamMemberships: string[],
    schemas: EntitySchema[],
    entities: Entity[],
    grants: EntityGrant[]
  ): AuthorizationContext {
    const globalRolesSet = new Set(globalRoles) as Set<import('./types.js').GlobalRole>;
    const globalPermissions = getGlobalPermissionsForRoles(globalRolesSet);

    return {
      userId,
      globalRoles: globalRolesSet,
      globalPermissions,
      teamIds: new Set(teamMemberships),
      schemas: new Map(schemas.map(schema => [schema.id, schema])),
      entities: new Map(entities.map(entity => [entity.id, entity])),
      grants
    };
  }
}
