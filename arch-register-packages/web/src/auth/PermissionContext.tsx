import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import {
  PermissionChecker,
  CapabilityEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext,
  type Entity,
  type EntityAction,
  type ProjectAction,
  type GlobalPermission,
  type TeamAssignment,
  WorkspaceRole
} from '@arch-register/permissions';
import { useAuth } from './AuthContext';
import { useAuthorizationData } from './AuthorizationDataContext';

type PermissionContextType = {
  /**
   * Check if user has a specific permission on an entity.
   * Returns false if user is not authenticated or authorization data is not loaded.
   */
  hasEntityPermission: (workspaceId: string, entity: Entity, action: EntityAction) => boolean;

  /**
   * Check if user has a specific permission on a project.
   * Returns false if user is not authenticated or authorization data is not loaded.
   */
  hasProjectPermission: (
    workspaceId: string,
    ownerTeamId: string | null,
    action: ProjectAction
  ) => boolean;

  /**
   * Check if user has a specific global permission.
   * Returns false if user is not authenticated or authorization data is not loaded.
   */
  hasGlobalPermission: (permission: GlobalPermission) => boolean;

  /**
   * Check if user can create a project with a specific owner.
   * Returns false if user is not authenticated or authorization data is not loaded.
   */
  canCreateProject: (workspaceId: string, ownerTeamId: string | null) => boolean;

  /**
   * Check if user can create a top-level entity with a specific owner.
   * Returns false if user is not authenticated or authorization data is not loaded.
   */
  canCreateTopLevelEntity: (workspaceId: string, ownerTeamId: string | null) => boolean;

  /**
   * Build authorization context for a workspace.
   * Returns null if user is not authenticated or authorization data is not loaded.
   *
   * Note: This requires entity and schema data which is not available in the base auth data.
   * For now, this returns a partial context that can be used for global and project permissions.
   */
  buildContext: (workspaceId: string) => AuthorizationContext | null;
};

const PermissionContext = createContext<PermissionContextType | null>(null);

/**
 * Permission context provider.
 *
 * Provides permission checking capabilities using the shared permission logic.
 * This context focuses solely on permission evaluation, separate from authentication
 * lifecycle and authorization data management.
 *
 * Note: Currently provides a simplified context without entity/schema data.
 * For full entity permission checks, components should fetch entity data separately
 * and use the permission checker directly.
 */
export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const authData = useAuthorizationData();

  // Create singleton instances
  const checker = useMemo(() => new PermissionChecker(), []);
  const capabilities = useMemo(() => new CapabilityEvaluator(), []);

  /**
   * Build a partial authorization context for the workspace.
   * This context can be used for global and project permissions,
   * but not for entity permissions (which require entity/schema data).
   */
  const buildContext = useCallback(
    (workspaceId: string): AuthorizationContext | null => {
      if (!user || !authData) return null;

      const teamAssignments =
        (authData.team_assignments_by_workspace?.[workspaceId] ?? []).map(
          assignment =>
            ({
              teamId: assignment.team_id,
              role: assignment.role
            }) satisfies TeamAssignment
        ) ?? [];
      const teams = authData.teams_by_workspace?.[workspaceId] ?? [];
      const workspaceRoles = authData.workspace_role_definitions_by_workspace?.[workspaceId] ?? [];

      const workspaceRole = (authData.workspace_roles?.[workspaceId] ??
        null) as WorkspaceRole | null;

      return buildAuthorizationContext({
        userId: user.id,
        globalRoles: authData.global_roles,
        workspaceRole,
        workspaceRoles,
        teamAssignments,
        teams,
        schemas: [],
        entities: [],
        grants: []
      });
    },
    [user, authData]
  );

  const hasEntityPermission = useCallback(
    (workspaceId: string, entity: Entity, action: EntityAction): boolean => {
      const context = buildContext(workspaceId);
      if (!context) return false;

      // Note: This will work for basic checks but may not have full entity hierarchy
      // For production use, entity/schema data should be fetched and included in context
      return checker.hasEntityPermission(context, entity, action);
    },
    [buildContext, checker]
  );

  const hasProjectPermission = useCallback(
    (workspaceId: string, ownerTeamId: string | null, action: ProjectAction): boolean => {
      const context = buildContext(workspaceId);
      if (!context) return false;

      return checker.hasProjectPermission(context, ownerTeamId, action);
    },
    [buildContext, checker]
  );

  const hasGlobalPermission = useCallback(
    (permission: GlobalPermission): boolean => {
      if (!user || !authData) return false;

      // For global permissions, we don't need workspace-specific context
      const context = buildAuthorizationContext({
        userId: user.id,
        globalRoles: authData.global_roles,
        workspaceRole: null,
        workspaceRoles: [],
        teamAssignments: [],
        teams: [],
        schemas: [],
        entities: [],
        grants: []
      });

      return checker.hasGlobalPermission(context, permission);
    },
    [user, authData, checker]
  );

  const canCreateProject = useCallback(
    (workspaceId: string, ownerTeamId: string | null): boolean => {
      const context = buildContext(workspaceId);
      if (!context) return false;

      return capabilities.canCreateProject(context, ownerTeamId);
    },
    [buildContext, capabilities]
  );

  const canCreateTopLevelEntity = useCallback(
    (workspaceId: string, ownerTeamId: string | null): boolean => {
      const context = buildContext(workspaceId);
      if (!context) return false;

      return capabilities.canCreateTopLevelEntity(context, ownerTeamId);
    },
    [buildContext, capabilities]
  );

  const value: PermissionContextType = {
    hasEntityPermission,
    hasProjectPermission,
    hasGlobalPermission,
    canCreateProject,
    canCreateTopLevelEntity,
    buildContext
  };

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

/**
 * Hook to access permission checking capabilities.
 *
 * @throws Error if used outside of PermissionProvider
 */
export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};
