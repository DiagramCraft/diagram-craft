import { useMemo } from 'react';
import {
  PermissionChecker,
  CapabilityEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext,
  type GlobalRole,
  type TeamAssignment,
  type WorkspaceTeam,
  type WorkspaceRole
} from '@arch-register/permissions';
import { useAuthorizationData } from './AuthorizationDataContext';

type WorkspacePermissions = {
  canManageWorkspaces: boolean;
  canManageGlobalRoles: boolean;
  canViewSchemas: boolean;
  canEditSchemas: boolean;
  canManageTeams: boolean;
  canViewAudit: boolean;
  canCreateProjects: boolean;
  canCreateEntities: boolean;
  canManageMembers: boolean;
  canManageViews: boolean;
};

const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();

const buildWorkspaceAuthorizationContext = (
  authorizationData: ReturnType<typeof useAuthorizationData>,
  workspaceId: string | null | undefined
): AuthorizationContext | null => {
  if (!authorizationData || !workspaceId) {
    return null;
  }

  const teamAssignments =
    (authorizationData.team_assignments_by_workspace?.[workspaceId] ?? []).map(
      assignment =>
        ({
          teamId: assignment.team_id,
          role: assignment.role,
        }) satisfies TeamAssignment
    ) ?? [];
  const teams = authorizationData.teams_by_workspace?.[workspaceId] ?? [];
  const workspaceRole = (authorizationData.workspace_roles?.[workspaceId] ?? null) as WorkspaceRole | null;
  const workspaceRoles = authorizationData.workspace_role_definitions_by_workspace?.[workspaceId] ?? [];

  return buildAuthorizationContext({
    userId: '',
    globalRoles: authorizationData.global_roles as GlobalRole[],
    workspaceRole,
    workspaceRoles,
    teamAssignments,
    teams: teams as WorkspaceTeam[],
    schemas: [],
    entities: [],
    grants: []
  });
};

export const useWorkspacePermissions = (
  workspaceId: string | null | undefined
): WorkspacePermissions => {
  const authorizationData = useAuthorizationData();

  return useMemo(() => {
    const context = buildWorkspaceAuthorizationContext(authorizationData, workspaceId);

    const canManageWorkspaces =
      context != null && checker.hasWorkspaceCapability(context, 'ws.settings');
    const canManageGlobalRoles =
      authorizationData?.global_permissions.includes('manage_workspace_roles') ?? false;
    const canViewSchemas = context != null && checker.hasWorkspaceCapability(context, 'ws.view');
    const canEditSchemas =
      context != null && checker.hasWorkspaceCapability(context, 'schema.edit');
    const canManageTeams =
      context != null && checker.hasWorkspaceCapability(context, 'people.teams');
    const canViewAudit = context != null && checker.hasWorkspaceCapability(context, 'ws.audit');
    const canManageMembers =
      context != null && checker.hasWorkspaceCapability(context, 'people.invite');
    const canManageViews =
      context != null && checker.hasWorkspaceCapability(context, 'ws.manage_views');
    const canCreateProjects =
      context != null &&
      (capabilities.canCreateProject(context, null) ||
        context.teams.some(team =>
          capabilities.canCreateProject(context, team.id)
        ));
    const canCreateEntities =
      context != null &&
      (capabilities.canCreateTopLevelEntity(context, null) ||
        context.teams.some(team =>
          capabilities.canCreateTopLevelEntity(context, team.id)
        ));

    return {
      canManageWorkspaces,
      canManageGlobalRoles,
      canViewSchemas,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities,
      canManageMembers,
      canManageViews
    };
  }, [authorizationData, workspaceId]);
};
