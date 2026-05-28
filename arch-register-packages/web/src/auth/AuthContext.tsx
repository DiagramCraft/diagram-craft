import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithOidc: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'ar_access_token';
const REFRESH_TOKEN_KEY = 'ar_refresh_token';
const TOKEN_EXPIRY_KEY = 'ar_token_expiry';

const BASE = import.meta.env.VITE_API_URL ?? '';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearTokens = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }, []);

  const saveTokens = useCallback((tokens: TokenResponse) => {
    localStorage.setItem(TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    const expiryTime = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        clearTokens();
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = await res.json();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [clearTokens]);

  const refreshToken = useCallback(async () => {
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshTokenValue) {
      clearTokens();
      setUser(null);
      throw new Error('No refresh token available');
    }

    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!res.ok) {
        clearTokens();
        setUser(null);
        throw new Error('Failed to refresh token');
      }

      const tokens: TokenResponse = await res.json();
      saveTokens(tokens);
      await fetchCurrentUser();
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  }, [clearTokens, saveTokens, fetchCurrentUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
      }

      const tokens: TokenResponse = await res.json();
      saveTokens(tokens);
      await fetchCurrentUser();
    },
    [saveTokens, fetchCurrentUser]
  );

  const loginWithOidc = useCallback(async () => {
    const res = await fetch(`${BASE}/api/auth/oidc/authorize`);
    if (!res.ok) {
      throw new Error('Failed to initiate OIDC login');
    }

    const { authorization_url } = await res.json();
    window.location.href = authorization_url;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, [clearTokens]);

  // Check for token expiry and refresh if needed
  useEffect(() => {
    const checkTokenExpiry = () => {
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryTime) return;

      const timeUntilExpiry = Number(expiryTime) - Date.now();
      // Refresh token 5 minutes before expiry
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken().catch(console.error);
      }
    };

    const interval = setInterval(checkTokenExpiry, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [refreshToken]);

  // Initial user fetch
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

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

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};
