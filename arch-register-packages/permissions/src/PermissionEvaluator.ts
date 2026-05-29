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
 * Shared permission checker.
 * Implements permission checks against an already-built authorization context.
 */
export class PermissionEvaluator {
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

  /**
   * Check if user has a specific permission on a project
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
   * Check if user has an assigned global permission
   */
  hasGlobalPermission(context: AuthorizationContext, permission: GlobalPermission): boolean {
    return (
      context.globalPermissions.has(permission) || context.globalPermissions.has('admin_platform')
    );
  }

  /**
   * Check if user can create a project for the given owner team
   */
  canCreateProject(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }

  /**
   * Check if user can create a top-level entity for the given owner team
   */
  canCreateTopLevelEntity(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    if (!this.hasGlobalPermission(context, 'view_schema')) {
      return false;
    }

    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }

  /**
   * Get all entity actions available to the user for a specific entity
   */
  protected getEntityActions(context: AuthorizationContext, entity: Entity): Set<EntityAction> {
    const actions = new Set<EntityAction>();

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

    if (this.resolveEntityVisibility(context, entity) === 'public') {
      actions.add('view_entity');
    }

    if (entity.owner && context.teamIds.has(entity.owner)) {
      ROLE_ACTIONS['entity_admin'].forEach(action => actions.add(action));
    }

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
}