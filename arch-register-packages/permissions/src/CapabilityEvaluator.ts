import type { AuthorizationContext } from './types.js';
import { PermissionChecker } from './PermissionChecker.js';

/**
 * Capability evaluator for computed permissions.
 * 
 * Evaluates capabilities that depend on context and business rules,
 * rather than just checking assigned permissions.
 * 
 * Naming convention:
 * - `can*` methods compute capabilities based on context
 * - May involve complex business logic beyond simple permission checks
 * 
 * Use this class when you need to determine if a user CAN perform an action
 * based on their roles, team memberships, and other contextual factors.
 */
export class CapabilityEvaluator {
  private checker: PermissionChecker;

  constructor() {
    this.checker = new PermissionChecker();
  }

  /**
   * Check if user can create a project with a specific owner.
   * 
   * A user can create a project if:
   * - They are a platform_admin (can create for any owner), OR
   * - The owner is a team they are a member of
   * 
   * @param context - Authorization context with user's roles and team memberships
   * @param ownerTeamId - The team that would own the project (null for no owner)
   * @returns true if the user can create a project with this owner, false otherwise
   */
  canCreateProject(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    // Platform admins can create projects for any owner
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    // Users can create projects for teams they are members of
    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }

  /**
   * Check if user can create a top-level entity with a specific owner.
   * 
   * A user can create a top-level entity if:
   * - They are a platform_admin (can create for any owner), OR
   * - They have view_schema permission AND the owner is a team they are a member of
   * 
   * The view_schema permission is required because creating entities requires
   * understanding the schema structure.
   * 
   * @param context - Authorization context with user's roles and permissions
   * @param ownerTeamId - The team that would own the entity (null for no owner)
   * @returns true if the user can create a top-level entity with this owner, false otherwise
   */
  canCreateTopLevelEntity(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    // Platform admins can create entities for any owner
    if (context.globalRoles.has('platform_admin')) {
      return true;
    }

    // Must have view_schema permission to create entities
    if (!this.checker.hasGlobalPermission(context, 'view_schema')) {
      return false;
    }

    // Users can create entities for teams they are members of
    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }
}