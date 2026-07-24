import type {
  AuthorizationContext,
  Entity,
  EntityAction,
  EntityGrant,
  EntitySchema,
  GlobalPermission,
  ProjectAction,
  TeamRole,
  WorkspaceAuthorizationContext,
  WorkspaceCapability
} from './types.js';
import { decodeRefs } from './utils.js';
import { ROLE_ACTIONS, TEAM_ROLE_PERMISSIONS } from './constants.js';

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
   * - Workspace-wide content.view (grants view_entity to any entity in the workspace)
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
   * - Global admin_platform permission (grants all project actions)
   * - Workspace role with proj.delete capability (for delete_project only)
   * - Workspace role with proj.edit capability (for non-delete actions)
   * - Owner team membership
   *
   * @param context - Authorization context with user's roles and permissions
   * @param ownerTeamId - The team that owns the project (null for no owner)
   * @param action - The specific action to check
   * @returns true if the user has the permission, false otherwise
   */
  hasProjectPermission(
    context: WorkspaceAuthorizationContext,
    ownerTeamId: string | null,
    action: ProjectAction
  ): boolean {
    if (context.globalPermissions.has('admin_platform')) {
      if (!context.workspaceCapabilityCeiling) return true;
      return action === 'delete_project'
        ? context.workspaceCapabilityCeiling.has('proj.delete')
        : context.workspaceCapabilityCeiling.has('proj.edit');
    }

    if (action === 'delete_project') {
      if (this.hasWorkspaceCapability(context, 'proj.delete')) {
        return true;
      }
    } else if (this.hasWorkspaceCapability(context, 'proj.edit')) {
      return true;
    }

    if (ownerTeamId != null) {
      for (const role of this.getTeamRoles(context, ownerTeamId)) {
        if (
          this.isProjectActionAllowedByCeiling(context, action) &&
          TEAM_ROLE_PERMISSIONS[role].projectActions.includes(action)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if user has a specific workspace capability via their workspace role.
   *
   * global_admin users implicitly have all workspace capabilities.
   */
  hasWorkspaceCapability(
    context: WorkspaceAuthorizationContext,
    capability: WorkspaceCapability
  ): boolean {
    if (context.workspaceCapabilityCeiling && !context.workspaceCapabilityCeiling.has(capability)) {
      return false;
    }

    if (context.globalPermissions.has('admin_platform')) {
      return (
        !context.workspaceCapabilityCeiling || context.workspaceCapabilityCeiling.has(capability)
      );
    }

    if (context.workspaceRole == null) {
      return false;
    }

    return (
      context.workspaceRoles.get(context.workspaceRole)?.capabilities.includes(capability) ?? false
    );
  }

  /**
   * Check if user has a specific assigned global permission.
   *
   * This checks the user's global permissions set, which is derived from
   * their global role assignments. global_admin role grants all permissions.
   *
   * @param context - Authorization context with user's roles and permissions
   * @param permission - The specific global permission to check
   * @returns true if the user has the permission, false otherwise
   */
  hasGlobalPermission(
    context: WorkspaceAuthorizationContext,
    permission: GlobalPermission
  ): boolean {
    return (
      !context.workspaceCapabilityCeiling &&
      (context.globalPermissions.has(permission) || context.globalPermissions.has('admin_platform'))
    );
  }

  /**
   * Check whether the user's workspace role alone (independent of any specific entity's
   * ownership, ancestry, or grants) already grants `view_entity` workspace-wide.
   *
   * This is true for `content.view`, `ent.edit`, or `ent.propose`, and for global admins — the
   * same conditions `getEntityActions` checks in its workspace-role branch. Callers doing
   * bulk/list queries can use this to skip the per-entity `hasEntityPermission` check entirely
   * (falling back to it only when this returns false, e.g. a token/role scoped to `ws.view` only).
   */
  hasWorkspaceWideEntityView(context: AuthorizationContext): boolean {
    if (!context.workspaceCapabilityCeiling && context.globalPermissions.has('admin_platform')) {
      return true;
    }
    if (context.workspaceRole == null && !context.globalPermissions.has('admin_platform')) {
      return false;
    }
    return (
      this.hasWorkspaceCapability(context, 'ent.edit') ||
      this.hasWorkspaceCapability(context, 'ent.propose') ||
      this.hasWorkspaceCapability(context, 'content.view')
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

    // Global admins get all entity actions
    if (!context.workspaceCapabilityCeiling && context.globalPermissions.has('admin_platform')) {
      ROLE_ACTIONS['entity_admin'].forEach(action => actions.add(action));
    }

    // Workspace role grants entity actions
    if (context.workspaceRole != null || context.globalPermissions.has('admin_platform')) {
      if (this.hasWorkspaceCapability(context, 'ent.edit')) {
        ROLE_ACTIONS['contributor'].forEach(action => actions.add(action));
      } else if (this.hasWorkspaceCapability(context, 'ent.propose')) {
        ROLE_ACTIONS['editor'].forEach(action => actions.add(action));
      } else if (this.hasWorkspaceCapability(context, 'content.view')) {
        actions.add('view_entity');
      }
    }

    const ancestorIds = this.collectAncestorIds(context, entity);

    // Direct owner team permissions apply to the entity itself
    if (entity.owner) {
      for (const role of this.getTeamRoles(context, entity.owner)) {
        this.addCappedEntityActions(
          actions,
          context,
          TEAM_ROLE_PERMISSIONS[role].directEntityActions
        );
      }
    }

    // Ancestor owner teams contribute descendant permissions downward.
    for (const ancestorId of ancestorIds) {
      const ancestor = context.entities.get(ancestorId);
      if (!ancestor?.owner) continue;
      for (const role of this.getTeamRoles(context, ancestor.owner)) {
        this.addCappedEntityActions(
          actions,
          context,
          TEAM_ROLE_PERMISSIONS[role].descendantEntityActions
        );
      }
    }

    // Check explicit entity grants
    for (const grant of context.grants) {
      const principalMatches =
        (grant.principal_type === 'user' && grant.principal_id === context.userId) ||
        (grant.principal_type === 'team' && context.teamRolesByTeam.has(grant.principal_id));

      if (!principalMatches) continue;
      if (!this.hasApplicableGrant(grant, entity.id, ancestorIds)) continue;

      this.addCappedEntityActions(actions, context, ROLE_ACTIONS[grant.role]);
    }

    return actions;
  }

  private isProjectActionAllowedByCeiling(
    context: WorkspaceAuthorizationContext,
    action: ProjectAction
  ): boolean {
    const ceiling = context.workspaceCapabilityCeiling;
    if (!ceiling) return true;
    return ceiling.has(action === 'delete_project' ? 'proj.delete' : 'proj.edit');
  }

  private isEntityActionAllowedByCeiling(
    context: AuthorizationContext,
    action: EntityAction
  ): boolean {
    const ceiling = context.workspaceCapabilityCeiling;
    if (!ceiling) return true;

    switch (action) {
      case 'view_entity':
        return ceiling.has('content.view') || ceiling.has('ent.edit') || ceiling.has('ent.propose');
      case 'edit_entity':
        return ceiling.has('ent.edit') || ceiling.has('ent.propose');
      case 'create_child':
        return ceiling.has('ent.edit');
      case 'admin_entity':
        return false;
    }
  }

  private addCappedEntityActions(
    actions: Set<EntityAction>,
    context: AuthorizationContext,
    candidateActions: EntityAction[]
  ): void {
    for (const action of candidateActions) {
      if (this.isEntityActionAllowedByCeiling(context, action)) actions.add(action);
    }
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

  protected getTeamRoles(context: WorkspaceAuthorizationContext, teamId: string): Set<TeamRole> {
    return context.teamRolesByTeam.get(teamId) ?? new Set<TeamRole>();
  }
}
