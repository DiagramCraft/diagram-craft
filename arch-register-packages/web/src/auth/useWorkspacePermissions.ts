import { useMemo } from 'react';
import { usePermissions } from './AuthContext';

type WorkspacePermissions = {
  canManageWorkspaces: boolean;
  canViewSchemas: boolean;
  canEditSchemas: boolean;
  canManageTeams: boolean;
  canViewAudit: boolean;
  canCreateProjects: boolean;
  canCreateEntities: boolean;
};

export const useWorkspacePermissions = (
  workspaceId: string | null | undefined
): WorkspacePermissions => {
  const { hasGlobalPermission, getWorkspaceOwnerOptions, getWorkspaceTeamIds } = usePermissions();

  return useMemo(() => {
    const canManageWorkspaces = hasGlobalPermission('admin_platform');
    const canViewSchemas = hasGlobalPermission('view_schema');
    const canEditSchemas = hasGlobalPermission('edit_schema');
    const canManageTeams = hasGlobalPermission('manage_teams');
    const canViewAudit = hasGlobalPermission('view_audit');
    const workspaceOwnerOptions = getWorkspaceOwnerOptions(workspaceId);
    const workspaceTeamIds = getWorkspaceTeamIds(workspaceId);
    const canCreateProjects =
      canManageWorkspaces ||
      workspaceOwnerOptions.some(option => workspaceTeamIds.includes(option.id));
    const canCreateEntities = canViewSchemas && canCreateProjects;

    return {
      canManageWorkspaces,
      canViewSchemas,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities
    };
  }, [
    getWorkspaceOwnerOptions,
    getWorkspaceTeamIds,
    hasGlobalPermission,
    workspaceId
  ]);
};
