import type {
  AuthorizationContext,
  Entity,
  EntityAction,
  EntityGrant,
  EntitySchema,
  GlobalPermission,
  ProjectAction,
  VisibilityMode
} from './types.js';
import { decodeRefs } from './types.js';
import { GLOBAL_ROLE_PERMISSIONS, ROLE_ACTIONS } from './constants.js';

/**
 * Pure permission checker.
 * 
 * Checks assigned permissions and roles against an authorization context.
 * Does NOT compute capabilities - use CapabilityEvaluator for that.
 * 
 * Naming convention:
 * - `has*` methods check assigned permissions/roles
 * - Returns boolean indicating if permission is granted
 */
export class PermissionChecker {
  /**
   * Check if user has a specific assigned permission on an entity.
   * 
   * This checks:
   * - Global roles that grant entity permissions
   * - Entity visibility (public entities are viewable by all)
   * - Owner team membership (grants entity_admin role)
   * - Explicit entity grants (direct or via subtree)
   * 
   * @param context - Authorization context with user's roles and permissions
   * @param entity - The entity to check permissions for
   * @param action - The specific action to check (view_entity, edit_entity, etc.)
   * @returns true if the user has the permission, false otherwise
   */
  hasEntityPermission(
    context: AuthorizationContext,
    entity: Entity,
    action: EntityAction
  ): boolean {
    const actions = this.getEntityActions(context, entity);
    return actions.has(action);
  }

  /**
   * Check if user has a specific assigned permission on a project.
   * 
   * This checks:
   * - Global platform_admin role
   * - Owner team membership
   * 
   * @param context - Authorization context with user's roles and permissions
   * @param ownerTeamId - The team that owns the project (null for no owner)
   * @param _action - The specific action to check (currently all actions treated uniformly)
   * @returns true if the user has the permission, false otherwise
   */
  hasProjectPermission(
    context: AuthorizationContext,
    ownerTeamId: string | null,
    _action: ProjectAction
  ): boolean {
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    if (ownerTeamId != null && context.teamIds.has(ownerTeamId)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has a specific assigned global permission.
   * 
   * This checks the user's global permissions set, which is derived from
   * their global role assignments. platform_admin role grants all permissions.
   * 
   * @param context - Authorization context with user's roles and permissions
   * @param permission - The specific global permission to check
   * @returns true if the user has the permission, false otherwise
   */
  hasGlobalPermission(context: AuthorizationContext, permission: GlobalPermission): boolean {
    return (
      context.globalPermissions.has(permission) || context.globalPermissions.has('admin_platform')
    );
  }

  /**
   * Get all entity actions available to the user for a specific entity.
   * 
   * This is the core logic that determines what actions a user can perform
   * on an entity by checking all possible permission sources.
   * 
   * @param context - Authorization context
   * @param entity - The entity to check
   * @returns Set of all available entity actions
   */
  protected getEntityActions(context: AuthorizationContext, entity: Entity): Set<EntityAction> {
    const actions = new Set<EntityAction>();

    // Check global roles for entity permissions
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

    // Public entities are viewable by all
    if (this.resolveEntityVisibility(context, entity) === 'public') {
      actions.add('view_entity');
    }

    // Owner team members get entity_admin role
    if (entity.owner && context.teamIds.has(entity.owner)) {
      ROLE_ACTIONS['entity_admin'].forEach(action => actions.add(action));
    }

    // Check explicit entity grants
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
   * Resolve the effective visibility mode for an entity by traversing up the containment hierarchy.
   * 
   * If an entity doesn't have an explicit visibility mode, we traverse up through
   * its parent entities until we find one with a visibility mode, or default to 'public'.
   * 
   * @param context - Authorization context with entity data
   * @param entity - The entity to resolve visibility for
   * @returns The effective visibility mode ('public' or 'restricted')
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
   * Collect all ancestor entity IDs by traversing containment relationships.
   * 
   * This is used to check if entity grants with 'subtree' scope apply to
   * the target entity.
   * 
   * @param context - Authorization context with entity data
   * @param entity - The entity to collect ancestors for
   * @returns Set of all ancestor entity IDs
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
   * Get parent entity IDs from containment fields.
   * 
   * Containment fields define parent-child relationships in the entity hierarchy.
   * 
   * @param entity - The entity to get parents for
   * @param schema - The entity's schema definition
   * @returns Array of parent entity IDs
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
   * Check if a grant applies to the target entity (either directly or via subtree).
   * 
   * @param grant - The entity grant to check
   * @param targetEntityId - The entity ID to check against
   * @param ancestorIds - Set of ancestor entity IDs
   * @returns true if the grant applies, false otherwise
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
}
