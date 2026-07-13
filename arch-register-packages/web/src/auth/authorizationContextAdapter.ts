import {
  buildWorkspaceAuthorizationContext,
  type TeamAssignment,
  type WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import type { AuthBaseData } from './types';

export const buildWorkspaceAuthorizationContextFromAuthData = (
  userId: string,
  authorizationData: AuthBaseData,
  workspaceId: string | null | undefined
): WorkspaceAuthorizationContext => {
  const teamAssignments = workspaceId
    ? (authorizationData.team_assignments_by_workspace?.[workspaceId] ?? []).map(
        assignment =>
          ({
            teamId: assignment.team_id,
            role: assignment.role
          }) satisfies TeamAssignment
      )
    : [];

  return buildWorkspaceAuthorizationContext({
    userId,
    globalRoles: authorizationData.global_roles,
    workspaceRole: workspaceId ? (authorizationData.workspace_roles[workspaceId] ?? null) : null,
    workspaceRoles: workspaceId
      ? (authorizationData.workspace_role_definitions_by_workspace?.[workspaceId] ?? [])
      : [],
    teamAssignments,
    teams: workspaceId ? (authorizationData.teams_by_workspace?.[workspaceId] ?? []) : []
  });
};
