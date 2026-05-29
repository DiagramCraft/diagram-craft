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
   * - They have the proj.create workspace capability, OR
   * - They are a global admin, OR
   * - The owner is a team they are a member of (and they have view access)
   */
  canCreateProject(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    if (this.checker.hasWorkspaceCapability(context, 'proj.create')) {
      return true;
    }

    // Users can create projects for teams they are members of
    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }

  /**
   * Check if user can create a top-level entity with a specific owner.
   *
   * A user can create a top-level entity if:
   * - They have the ent.edit workspace capability, OR
   * - They are a global admin, OR
   * - The owner is a team they are a member of (and they have schema view)
   */
  canCreateTopLevelEntity(context: AuthorizationContext, ownerTeamId: string | null): boolean {
    if (this.checker.hasWorkspaceCapability(context, 'ent.edit')) {
      return true;
    }

    // Users can create entities for teams they are members of
    return ownerTeamId != null && context.teamIds.has(ownerTeamId);
  }
}
