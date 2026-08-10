import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  CapabilityEvaluator,
  getFieldGroupAccess,
  PermissionChecker,
  type FieldGroupAccess,
  type FieldGroupAccessControl,
  type GlobalPermission,
  type ProjectAction,
  type WorkspaceAuthorizationContext as NormalizedWorkspaceAuthorizationContext
} from '@arch-register/permissions';
import { useAuth } from './AuthContext';
import { useAuthorizationData } from './AuthorizationDataContext';
import { buildWorkspaceAuthorizationContextFromAuthData } from './authorizationContextAdapter';

export type WorkspaceAuthorization = {
  context: NormalizedWorkspaceAuthorizationContext | null;
  checker: PermissionChecker;
  capabilities: CapabilityEvaluator;
  hasProjectPermission: (ownerTeamId: string | null, action: ProjectAction) => boolean;
  hasGlobalPermission: (permission: GlobalPermission) => boolean;
  canCreateProject: (ownerTeamId: string | null) => boolean;
  canCreateTopLevelEntity: (ownerTeamId: string | null) => boolean;
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  canManageWorkspaces: boolean;
  canAdministerWorkspace: boolean;
  canManageGlobalRoles: boolean;
  canViewSchemas: boolean;
  canViewArtifactContent: boolean;
  canEditSchemas: boolean;
  canManageTeams: boolean;
  canViewAudit: boolean;
  canCreateProjects: boolean;
  canCreateEntities: boolean;
  canManageMembers: boolean;
  canManageJobs: boolean;
  canManageViews: boolean;
  canManageDashboard: boolean;
  canManageAdminViews: boolean;
  canOverrideEntityApproval: boolean;
};

type WorkspaceAuthorizationSource = {
  getContext: (
    workspaceId: string | null | undefined
  ) => NormalizedWorkspaceAuthorizationContext | null;
  checker: PermissionChecker;
  capabilities: CapabilityEvaluator;
};

const WorkspaceAuthorizationSourceContext = createContext<WorkspaceAuthorizationSource | null>(
  null
);

/**
 * Owns the shared frontend authorization source.
 *
 * Normalized workspace contexts are cached for the lifetime of the current auth snapshot so every
 * consumer uses the same context, checker, and capability evaluator instances.
 */
export const WorkspaceAuthorizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const authorizationData = useAuthorizationData();
  const checker = useMemo(() => new PermissionChecker(), []);
  const capabilities = useMemo(() => new CapabilityEvaluator(), []);

  const getContext = useMemo(() => {
    const contexts = new Map<string | null, NormalizedWorkspaceAuthorizationContext>();

    return (workspaceId: string | null | undefined) => {
      if (!user || !authorizationData) return null;

      const contextKey = workspaceId || null;
      const cached = contexts.get(contextKey);
      if (cached) return cached;

      const context = buildWorkspaceAuthorizationContextFromAuthData(
        user.id,
        authorizationData,
        contextKey
      );
      contexts.set(contextKey, context);
      return context;
    };
  }, [authorizationData, user]);

  const source = useMemo<WorkspaceAuthorizationSource>(
    () => ({ getContext, checker, capabilities }),
    [capabilities, checker, getContext]
  );

  return (
    <WorkspaceAuthorizationSourceContext.Provider value={source}>
      {children}
    </WorkspaceAuthorizationSourceContext.Provider>
  );
};

/**
 * Returns authorization data, evaluators, and selectors bound to one workspace.
 *
 * Workspace-level checks fail closed when no workspace is selected or authorization data is not
 * loaded. Global checks can still be evaluated without a selected workspace.
 */
export const useWorkspaceAuthorization = (
  workspaceId: string | null | undefined
): WorkspaceAuthorization => {
  const source = useContext(WorkspaceAuthorizationSourceContext);
  if (!source) {
    throw new Error('useWorkspaceAuthorization must be used within WorkspaceAuthorizationProvider');
  }

  const context = useMemo(() => source.getContext(workspaceId), [source, workspaceId]);
  const hasWorkspaceContext = context != null && !!workspaceId;

  const hasProjectPermission = useCallback(
    (ownerTeamId: string | null, action: ProjectAction): boolean => {
      if (!context || !workspaceId) return false;
      return source.checker.hasProjectPermission(context, ownerTeamId, action);
    },
    [context, source.checker, workspaceId]
  );

  const hasGlobalPermission = useCallback(
    (permission: GlobalPermission): boolean => {
      if (!context) return false;
      return source.checker.hasGlobalPermission(context, permission);
    },
    [context, source.checker]
  );

  const canCreateProject = useCallback(
    (ownerTeamId: string | null): boolean => {
      if (!context || !workspaceId) return false;
      return source.capabilities.canCreateProject(context, ownerTeamId);
    },
    [context, source.capabilities, workspaceId]
  );

  const canCreateTopLevelEntity = useCallback(
    (ownerTeamId: string | null): boolean => {
      if (!context || !workspaceId) return false;
      return source.capabilities.canCreateTopLevelEntity(context, ownerTeamId);
    },
    [context, source.capabilities, workspaceId]
  );

  const getFieldGroupAccessForContext = useCallback(
    (accessControl: FieldGroupAccessControl | undefined): FieldGroupAccess =>
      context ? getFieldGroupAccess(context, accessControl) : 'edit',
    [context]
  );

  const selectors = useMemo(() => {
    const { checker, capabilities } = source;

    const canManageWorkspaces =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.settings');
    const canAdministerWorkspace =
      hasWorkspaceContext &&
      (checker.hasWorkspaceCapability(context, 'people.role') ||
        checker.hasGlobalPermission(context, 'admin_platform'));
    const canManageGlobalRoles =
      context != null && checker.hasGlobalPermission(context, 'manage_workspace_roles');
    const canViewSchemas =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.view');
    const canViewArtifactContent =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'artifact.content.view');
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
    const canManageDashboard =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.manage_dashboard');
    const canManageAdminViews =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ws.settings');
    const canOverrideEntityApproval =
      hasWorkspaceContext && checker.hasWorkspaceCapability(context, 'ent.override');
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
      canAdministerWorkspace,
      canManageGlobalRoles,
      canViewSchemas,
      canViewArtifactContent,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities,
      canManageMembers,
      canManageJobs,
      canManageViews,
      canManageDashboard,
      canManageAdminViews,
      canOverrideEntityApproval
    };
  }, [context, hasWorkspaceContext, source]);

  return useMemo(
    () => ({
      context,
      checker: source.checker,
      capabilities: source.capabilities,
      hasProjectPermission,
      hasGlobalPermission,
      canCreateProject,
      canCreateTopLevelEntity,
      getFieldGroupAccess: getFieldGroupAccessForContext,
      ...selectors
    }),
    [
      canCreateProject,
      canCreateTopLevelEntity,
      context,
      getFieldGroupAccessForContext,
      hasGlobalPermission,
      hasProjectPermission,
      selectors,
      source.capabilities,
      source.checker
    ]
  );
};
