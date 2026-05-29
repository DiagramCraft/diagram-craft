import { useMemo } from 'react';
import {
  PermissionEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext,
  type GlobalRole,
  type WorkspaceOwnerOption
} from '@arch-register/permissions';
import {
  useAuthorizationData,
  type WorkspaceTeamMembership
} from './AuthorizationDataContext';

type WorkspacePermissions = {
  canManageWorkspaces: boolean;
  canViewSchemas: boolean;
  canEditSchemas: boolean;
  canManageTeams: boolean;
  canViewAudit: boolean;
  canCreateProjects: boolean;
  canCreateEntities: boolean;
};

const evaluator = new PermissionEvaluator();

const buildWorkspaceAuthorizationContext = (
  authorizationData: ReturnType<typeof useAuthorizationData>,
  workspaceId: string | null | undefined
): AuthorizationContext | null => {
  if (!authorizationData || !workspaceId) {
    return null;
  }

  const teamMemberships =
    authorizationData.team_memberships.find(
      (membership: WorkspaceTeamMembership) => membership.workspace_id === workspaceId
    )?.team_ids ?? [];
  const ownerOptions = authorizationData.owner_options_by_workspace[workspaceId] ?? [];

  return buildAuthorizationContext({
    userId: '',
    globalRoles: authorizationData.global_roles as GlobalRole[],
    teamMemberships,
    ownerOptions: ownerOptions as WorkspaceOwnerOption[],
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
      context != null && evaluator.hasGlobalPermission(context, 'admin_platform');
    const canViewSchemas = context != null && evaluator.hasGlobalPermission(context, 'view_schema');
    const canEditSchemas = context != null && evaluator.hasGlobalPermission(context, 'edit_schema');
    const canManageTeams = context != null && evaluator.hasGlobalPermission(context, 'manage_teams');
    const canViewAudit = context != null && evaluator.hasGlobalPermission(context, 'view_audit');
    const firstOwnerTeamId = context?.ownerOptions[0]?.id ?? null;
    const canCreateProjects =
      context != null && evaluator.canCreateProject(context, firstOwnerTeamId);
    const canCreateEntities =
      context != null && evaluator.canCreateTopLevelEntity(context, firstOwnerTeamId);

    return {
      canManageWorkspaces,
      canViewSchemas,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities
    };
  }, [authorizationData, workspaceId]);
};
