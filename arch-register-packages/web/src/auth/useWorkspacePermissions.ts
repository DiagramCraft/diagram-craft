import { useMemo } from 'react';
import {
  PermissionChecker,
  CapabilityEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext,
  type GlobalRole,
  type WorkspaceOwnerOption,
  type WorkspaceRole
} from '@arch-register/permissions';
import { useAuthorizationData, type WorkspaceTeamMembership } from './AuthorizationDataContext';

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

  const teamMemberships =
    authorizationData.team_memberships.find(
      (membership: WorkspaceTeamMembership) => membership.workspace_id === workspaceId
    )?.team_ids ?? [];
  const ownerOptions = authorizationData.owner_options_by_workspace[workspaceId] ?? [];
  const workspaceRole = (authorizationData.workspace_roles?.[workspaceId] ?? null) as WorkspaceRole | null;

  return buildAuthorizationContext({
    userId: '',
    globalRoles: authorizationData.global_roles as GlobalRole[],
    workspaceRole,
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
    const canCreateProjects =
      context != null &&
      (capabilities.canCreateProject(context, null) ||
        context.ownerOptions.some(ownerOption =>
          capabilities.canCreateProject(context, ownerOption.id)
        ));
    const canCreateEntities =
      context != null &&
      (capabilities.canCreateTopLevelEntity(context, null) ||
        context.ownerOptions.some(ownerOption =>
          capabilities.canCreateTopLevelEntity(context, ownerOption.id)
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
      canManageMembers
    };
  }, [authorizationData, workspaceId]);
};
