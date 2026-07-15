import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { AuthorizationDataProvider } from './AuthorizationDataContext';
import type { User, GlobalPermission, GlobalRole, WorkspaceTeam, AuthBaseData } from './types';
import {
  clearAccessTokenExpiry,
  fetchWithAuthResponse,
  getAccessTokenExpiresAt,
  refreshAccessToken,
  registerSessionExpiredHandler,
  setAccessTokenExpiryFromSeconds
} from './authClient';

export type { User, GlobalPermission, GlobalRole, WorkspaceTeam, AuthBaseData };

type AuthMeResponse = User & AuthBaseData;

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithOidc: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authBaseData, setAuthBaseData] = useState<AuthBaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    clearAccessTokenExpiry();
    setUser(null);
    setAuthBaseData(null);
  }, []);

  const fetchCurrentUser = useCallback(
    async (retryOnUnauthorized = true): Promise<boolean> => {
      try {
        const res = await fetchWithAuthResponse('/api/auth/me', undefined, { retryOnUnauthorized });

        if (!res.ok) {
          clearAuthState();
          return false;
        }

        const userData = (await res.json()) as AuthMeResponse;
        setUser({
          id: userData.id,
          email: userData.email,
          display_name: userData.display_name,
          auth_provider: userData.auth_provider,
          color: userData.color,
          created_at: userData.created_at,
          last_login_at: userData.last_login_at
        });
        setAuthBaseData({
          global_roles: userData.global_roles,
          global_permissions: userData.global_permissions,
          team_assignments_by_workspace: userData.team_assignments_by_workspace ?? {},
          workspace_roles: userData.workspace_roles ?? {},
          workspace_role_definitions_by_workspace:
            userData.workspace_role_definitions_by_workspace ?? {},
          teams_by_workspace: userData.teams_by_workspace ?? {}
        });
        return true;
      } catch (error) {
        console.error('Failed to fetch user:', error);
        clearAuthState();
        return false;
      }
    },
    [clearAuthState]
  );

  const refreshToken = useCallback(
    async (reloadUser = true) => {
      try {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuthState();
          throw new Error('Failed to refresh token');
        }

        if (reloadUser) {
          await fetchCurrentUser();
        }
      } catch (error) {
        clearAuthState();
        throw error;
      }
    },
    [clearAuthState, fetchCurrentUser]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetchWithAuthResponse(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        },
        { requiresAuth: false, retryOnUnauthorized: false }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message ?? 'Login failed');
      }

      const data = await res.json();
      setAccessTokenExpiryFromSeconds(data.expires_in);
      await fetchCurrentUser();
    },
    [fetchCurrentUser]
  );

  const loginWithOidc = useCallback(async () => {
    const res = await fetchWithAuthResponse('/api/auth/oidc/authorize', undefined, {
      requiresAuth: false,
      retryOnUnauthorized: false
    });
    if (!res.ok) {
      throw new Error('Failed to initiate OIDC login');
    }

    const { authorization_url } = await res.json();
    window.location.href = authorization_url;
  }, []);

  const logout = useCallback(async () => {
    await fetchWithAuthResponse(
      '/api/auth/logout',
      { method: 'POST' },
      { requiresAuth: false, retryOnUnauthorized: false }
    ).catch(() => {});
    clearAuthState();
  }, [clearAuthState]);

  useEffect(() => {
    const checkTokenExpiry = () => {
      const tokenExpiresAt = getAccessTokenExpiresAt();
      if (!tokenExpiresAt || !user) return;

      const timeUntilExpiry = tokenExpiresAt - Date.now();
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken().catch(console.error);
      }
    };

    const interval = setInterval(checkTokenExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshToken, user]);

  useEffect(() => {
    const init = async () => {
      const ok = await fetchCurrentUser(false);
      if (ok) {
        if (getAccessTokenExpiresAt() == null) {
          try {
            await refreshToken(false);
          } catch {
            // Session could not be refreshed, leave user signed out.
          }
        }
      } else {
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

  useEffect(() => {
    return registerSessionExpiredHandler(({ redirectTo, reason }) => {
      clearAuthState();

      if (window.location.pathname === '/login') {
        return;
      }

      const params = new URLSearchParams({
        redirect: redirectTo,
        reason
      });
      window.location.assign(`/login?${params.toString()}`);
    });
  }, [clearAuthState]);

  const authValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithOidc,
    logout,
    refreshToken: () => refreshToken(),
    reloadUser: async () => {
      await fetchCurrentUser();
    }
  };

  return (
    <AuthContext.Provider value={authValue}>
      <AuthorizationDataProvider value={authBaseData}>{children}</AuthorizationDataProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
