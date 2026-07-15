type RefreshTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type SessionExpiredHandler = (opts: { redirectTo: string; reason: 'session-expired' }) => void;

type AuthFetchOptions = {
  requiresAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

const BASE = import.meta.env.VITE_API_URL ?? '';

let refreshInFlight: Promise<boolean> | null = null;
let accessTokenExpiresAt: number | null = null;
let sessionExpiredNotified = false;

const sessionExpiredHandlers = new Set<SessionExpiredHandler>();

const toRequestUrl = (path: string) => `${BASE}${path}`;

const isRefreshPath = (path: string) => path === '/api/auth/refresh';

const notifySessionExpired = () => {
  if (sessionExpiredNotified) return;

  sessionExpiredNotified = true;
  const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  for (const handler of sessionExpiredHandlers) {
    handler({ redirectTo, reason: 'session-expired' });
  }
};

const fetchWithCredentials = (path: string, init?: RequestInit) =>
  fetch(toRequestUrl(path), { ...init, credentials: 'include' });

export const registerSessionExpiredHandler = (handler: SessionExpiredHandler) => {
  sessionExpiredHandlers.add(handler);
  return () => {
    sessionExpiredHandlers.delete(handler);
  };
};

export const setAccessTokenExpiryFromSeconds = (expiresIn: number) => {
  accessTokenExpiresAt = Date.now() + expiresIn * 1000;
  sessionExpiredNotified = false;
};

export const clearAccessTokenExpiry = () => {
  accessTokenExpiresAt = null;
};

export const getAccessTokenExpiresAt = () => accessTokenExpiresAt;

export const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetchWithCredentials('/api/auth/refresh', { method: 'POST' });

      if (!response.ok) {
        clearAccessTokenExpiry();
        return false;
      }

      const data = (await response.json()) as RefreshTokenResponse;
      setAccessTokenExpiryFromSeconds(data.expires_in);
      return true;
    } catch {
      clearAccessTokenExpiry();
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

export const fetchWithAuthResponse = async (
  path: string,
  init?: RequestInit,
  options: AuthFetchOptions = {}
): Promise<Response> => {
  const { requiresAuth = true, retryOnUnauthorized = true } = options;
  const response = await fetchWithCredentials(path, init);

  if (!requiresAuth || !retryOnUnauthorized || response.status !== 401 || isRefreshPath(path)) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    notifySessionExpired();
    return response;
  }

  const retriedResponse = await fetchWithCredentials(path, init);
  if (retriedResponse.status === 401) {
    clearAccessTokenExpiry();
    notifySessionExpired();
  }

  return retriedResponse;
};
