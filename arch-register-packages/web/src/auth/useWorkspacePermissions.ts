import { useMemo } from 'react';
import { PermissionChecker, CapabilityEvaluator } from '@arch-register/permissions';
import { useAuth } from './AuthContext';
import { useAuthorizationData } from './AuthorizationDataContext';
import { buildWorkspaceAuthorizationContextFromAuthData } from './authorizationContextAdapter';

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
  canManageJobs: boolean;
  canManageViews: boolean;
  canManageAdminViews: boolean;
};

const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();

export const useWorkspacePermissions = (
  workspaceId: string | null | undefined
): WorkspacePermissions => {
  const { user } = useAuth();
  const authorizationData = useAuthorizationData();

  return useMemo(() => {
    const context =
      user && authorizationData
        ? buildWorkspaceAuthorizationContextFromAuthData(user.id, authorizationData, workspaceId)
        : null;
    const hasWorkspaceContext = context != null && !!workspaceId;

    const canManageWorkspaces =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.settings');
    const canManageGlobalRoles =
      context != null && checker.hasGlobalPermission(context, 'manage_workspace_roles');
    const canViewSchemas =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.view');
    const canEditSchemas =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'schema.edit');
    const canManageTeams =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'people.teams');
    const canViewAudit = hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.audit');
    const canManageMembers =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'people.invite');
    const canManageJobs =
      hasWorkspaceContext &&
      (checker.hasWorkspaceCapability(context, 'people.role') ||
        checker.hasGlobalPermission(context, 'admin_platform'));
    const canManageViews =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.manage_views');
    const canManageAdminViews =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.settings');
    const canCreateProjects =
      hasWorkspaceContext &&
      (capabilities.canCreateProject(context, null) ||
        context.teams.some(team => capabilities.canCreateProject(context, team.id)));
    const canCreateEntities =
      hasWorkspaceContext &&
      (capabilities.canCreateTopLevelEntity(context, null) ||
        context.teams.some(team => capabilities.canCreateTopLevelEntity(context, team.id)));

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
      canManageJobs,
      canManageViews,
      canManageAdminViews
    };
  }, [authorizationData, user, workspaceId]);
};
