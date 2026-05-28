import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode
} from 'react';
import { WebDataProvider, WebPermissionEvaluator } from './WebPermissionEvaluator.js';
import type { Entity, EntityAction, AuthorizationContext } from '@arch-register/permissions';

export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
};

export type GlobalPermission =
  | 'view_schema'
  | 'edit_schema'
  | 'manage_users'
  | 'manage_teams'
  | 'manage_global_roles'
  | 'view_audit'
  | 'admin_platform';

export type GlobalRole = 'platform_admin' | 'schema_admin' | 'user_admin' | 'auditor';

export type WorkspaceTeamMembership = {
  workspace_id: string;
  team_ids: string[];
};

export type AuthSnapshot = {
  global_roles: GlobalRole[];
  global_permissions: GlobalPermission[];
  team_memberships: WorkspaceTeamMembership[];
};

type AuthMeResponse = User & AuthSnapshot;

type AuthContextType = {
  user: User | null;
  authCtx: AuthSnapshot | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isMemberOfTeam: (
    workspaceId: string | null | undefined,
    teamId: string | null | undefined
  ) => boolean;
  getWorkspaceTeamIds: (workspaceId: string | null | undefined) => string[];
  login: (username: string, password: string) => Promise<void>;
  loginWithOidc: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  // Permission evaluator methods
  hasGlobalPermission: (permission: GlobalPermission) => boolean;
  checkEntityPermission: (
    workspaceId: string,
    entity: Entity,
    action: EntityAction
  ) => Promise<boolean>;
  buildPermissionContext: (workspaceId: string) => Promise<AuthorizationContext | null>;
  clearPermissionCache: (workspaceId?: string) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const BASE = import.meta.env.VITE_API_URL ?? '';

const authFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, credentials: 'include' });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authCtx, setAuthCtx] = useState<AuthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenExpiresAt = useRef<number | null>(null);
  const [evaluator] = useState(() => new WebPermissionEvaluator());

  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    try {
      const res = await authFetch('/api/auth/me');

      if (!res.ok) {
        setUser(null);
        setAuthCtx(null);
        return false;
      }

      const userData = (await res.json()) as AuthMeResponse;
      setUser({
        id: userData.id,
        email: userData.email,
        display_name: userData.display_name,
        auth_provider: userData.auth_provider,
        created_at: userData.created_at,
        last_login_at: userData.last_login_at
      });
      setAuthCtx({
        global_roles: userData.global_roles,
        global_permissions: userData.global_permissions,
        team_memberships: userData.team_memberships
      });
      return true;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      setAuthCtx(null);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/refresh', { method: 'POST' });

      if (!res.ok) {
        setUser(null);
        setAuthCtx(null);
        throw new Error('Failed to refresh token');
      }

      const data = await res.json();
      tokenExpiresAt.current = Date.now() + data.expires_in * 1000;
      await fetchCurrentUser();
    } catch (error) {
      setUser(null);
      setAuthCtx(null);
      throw error;
    }
  }, [fetchCurrentUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
      }

      const data = await res.json();
      tokenExpiresAt.current = Date.now() + data.expires_in * 1000;
      await fetchCurrentUser();
    },
    [fetchCurrentUser]
  );

  const loginWithOidc = useCallback(async () => {
    const res = await authFetch('/api/auth/oidc/authorize');
    if (!res.ok) {
      throw new Error('Failed to initiate OIDC login');
    }

    const { authorization_url } = await res.json();
    window.location.href = authorization_url;
  }, []);

  const logout = useCallback(async () => {
    await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    tokenExpiresAt.current = null;
    setUser(null);
    setAuthCtx(null);
  }, []);

  // Proactive token refresh before expiry
  useEffect(() => {
    const checkTokenExpiry = () => {
      if (!tokenExpiresAt.current || !user) return;

      const timeUntilExpiry = tokenExpiresAt.current - Date.now();
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken().catch(console.error);
      }
    };

    const interval = setInterval(checkTokenExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshToken, user]);

  // On mount: try /me, if 401 try refresh, otherwise not authenticated
  useEffect(() => {
    const init = async () => {
      const ok = await fetchCurrentUser();
      if (!ok) {
        try {
          await refreshToken();
        } catch {
          // Not authenticated
        }
      }
      setIsLoading(false);
    };
    init();
  }, [fetchCurrentUser, refreshToken]);

  const hasGlobalPermission = useCallback(
    (permission: GlobalPermission) => authCtx?.global_permissions.includes(permission) ?? false,
    [authCtx]
  );

  const getWorkspaceTeamIds = useCallback(
    (workspaceId: string | null | undefined) =>
      authCtx?.team_memberships.find(membership => membership.workspace_id === workspaceId)
        ?.team_ids ?? [],
    [authCtx]
  );

  const isMemberOfTeam = useCallback(
    (workspaceId: string | null | undefined, teamId: string | null | undefined) =>
      teamId != null && getWorkspaceTeamIds(workspaceId).includes(teamId),
    [getWorkspaceTeamIds]
  );

  const checkEntityPermission = useCallback(
    async (workspaceId: string, entity: Entity, action: EntityAction): Promise<boolean> => {
      if (!user) return false;
      try {
        const context = await evaluator.buildContext(
          workspaceId,
          user.id,
          new WebDataProvider(BASE)
        );
        return evaluator.hasEntityPermission(context, entity, action);
      } catch (error) {
        console.error('Failed to check entity permission:', error);
        return false;
      }
    },
    [user, evaluator]
  );

  const buildPermissionContext = useCallback(
    async (workspaceId: string): Promise<AuthorizationContext | null> => {
      if (!user) return null;
      try {
        return await evaluator.buildContext(workspaceId, user.id, new WebDataProvider(BASE));
      } catch (error) {
        console.error('Failed to build permission context:', error);
        return null;
      }
    },
    [user, evaluator]
  );

  const clearPermissionCache = useCallback(
    (workspaceId?: string) => {
      if (workspaceId && user) {
        evaluator.clearCache(workspaceId, user.id);
      } else {
        evaluator.clearCache();
      }
    },
    [user, evaluator]
  );

  const value: AuthContextType = {
    user,
    authCtx,
    isLoading,
    isAuthenticated: !!user,
    hasGlobalPermission,
    isMemberOfTeam,
    getWorkspaceTeamIds,
    login,
    loginWithOidc,
    logout,
    refreshToken,
    checkEntityPermission,
    buildPermissionContext,
    clearPermissionCache
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
