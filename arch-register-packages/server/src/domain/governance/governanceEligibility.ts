import {
  PermissionChecker,
  type AuthorizationContext,
  type TeamRole,
  type WorkspaceCapability
} from '@arch-register/permissions';
import type { GovernanceAssignmentDbResult } from './db/governanceDatabase';

const checker = new PermissionChecker();

export type EligibilityResult =
  | { eligible: true; authorizationPath: string }
  | { eligible: false; authorizationPath?: undefined };

/**
 * Determines whether the given user is eligible to decide an assignment, and records the
 * authorization path that made them eligible (per #2124: "the recorded decision must include
 * the actual actor and the authorization path that made them eligible").
 *
 * Eligibility is evaluated authoritatively here, at decision time — not cached from when the
 * assignment was created.
 */
export const resolveAssignmentEligibility = (
  authCtx: AuthorizationContext,
  userId: string,
  assignment: GovernanceAssignmentDbResult
): EligibilityResult => {
  switch (assignment.target_type) {
    case 'user': {
      if (assignment.target_user_id === userId) {
        return { eligible: true, authorizationPath: 'assigned_user' };
      }
      return { eligible: false };
    }
    case 'team_role': {
      if (!assignment.target_team_id || !assignment.target_team_role) return { eligible: false };
      const roles = authCtx.teamRolesByTeam.get(assignment.target_team_id);
      if (roles?.has(assignment.target_team_role as TeamRole)) {
        return {
          eligible: true,
          authorizationPath: `team_role:${assignment.target_team_id}:${assignment.target_team_role}`
        };
      }
      return { eligible: false };
    }
    case 'capability': {
      if (!assignment.target_capability) return { eligible: false };
      if (
        checker.hasWorkspaceCapability(authCtx, assignment.target_capability as WorkspaceCapability)
      ) {
        return { eligible: true, authorizationPath: `capability:${assignment.target_capability}` };
      }
      return { eligible: false };
    }
    default:
      return { eligible: false };
  }
};

export const isEligibleForAssignment = (
  authCtx: AuthorizationContext,
  userId: string,
  assignment: GovernanceAssignmentDbResult
): boolean => resolveAssignmentEligibility(authCtx, userId, assignment).eligible;
