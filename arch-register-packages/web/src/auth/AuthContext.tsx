import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithOidc: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const BASE = import.meta.env.VITE_API_URL ?? '';

const authFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, credentials: 'include' });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenExpiresAt = useRef<number | null>(null);

  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    try {
      const res = await authFetch('/api/auth/me');

      if (!res.ok) {
        setUser(null);
        return false;
      }

      const userData = await res.json();
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/refresh', { method: 'POST' });

      if (!res.ok) {
        setUser(null);
        throw new Error('Failed to refresh token');
      }

      const data = await res.json();
      tokenExpiresAt.current = Date.now() + data.expires_in * 1000;
      await fetchCurrentUser();
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, [fetchCurrentUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
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

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithOidc,
    logout,
    refreshToken,
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
