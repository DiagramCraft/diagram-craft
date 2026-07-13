import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import {
  PermissionChecker,
  CapabilityEvaluator,
  type ProjectAction,
  type GlobalPermission,
  type WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import { useAuth } from './AuthContext';
import { useAuthorizationData } from './AuthorizationDataContext';
import { buildWorkspaceAuthorizationContextFromAuthData } from './authorizationContextAdapter';

type PermissionContextType = {
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
};

const PermissionContext = createContext<PermissionContextType | null>(null);

/**
 * Permission context provider.
 *
 * Provides permission checking capabilities using the shared permission logic.
 * This context focuses solely on permission evaluation, separate from authentication
 * lifecycle and authorization data management.
 *
 * Entity permissions are evaluated on the server and returned with entity API responses.
 */
export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const authData = useAuthorizationData();

  // Create singleton instances
  const checker = useMemo(() => new PermissionChecker(), []);
  const capabilities = useMemo(() => new CapabilityEvaluator(), []);

  const buildContext = useCallback(
    (workspaceId: string | null): WorkspaceAuthorizationContext | null => {
      if (!user || !authData) return null;

      return buildWorkspaceAuthorizationContextFromAuthData(user.id, authData, workspaceId);
    },
    [user, authData]
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
      const context = buildContext(null);
      if (!context) return false;

      return checker.hasGlobalPermission(context, permission);
    },
    [buildContext, checker]
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
    hasProjectPermission,
    hasGlobalPermission,
    canCreateProject,
    canCreateTopLevelEntity
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
