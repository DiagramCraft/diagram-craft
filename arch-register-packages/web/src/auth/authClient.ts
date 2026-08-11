import { resolveApiUrl } from '../lib/apiUrl';

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

type AuthRequestTarget = string | URL;

let refreshInFlight: Promise<boolean> | null = null;
let accessTokenExpiresAt: number | null = null;
let sessionExpiredNotified = false;

const sessionExpiredHandlers = new Set<SessionExpiredHandler>();

const toRequestUrl = (target: AuthRequestTarget) => resolveApiUrl(target);

const isRefreshPath = (target: AuthRequestTarget) => {
  const path = new URL(resolveApiUrl(target)).pathname.replace(/\/+$/, '');
  return path.endsWith('/api/auth/refresh');
};

const notifySessionExpired = () => {
  if (sessionExpiredNotified) return;

  sessionExpiredNotified = true;
  const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  for (const handler of sessionExpiredHandlers) {
    handler({ redirectTo, reason: 'session-expired' });
  }
};

const fetchWithCredentials = (target: AuthRequestTarget, init?: RequestInit) =>
  fetch(toRequestUrl(target), { ...init, credentials: 'include' });

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
};

const awaitWithAbort = async <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
};

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

export const refreshAccessToken = async (signal?: AbortSignal): Promise<boolean> => {
  if (!refreshInFlight) {
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
  }

  return awaitWithAbort(refreshInFlight, signal);
};

export const fetchWithAuthResponse = async (
  target: AuthRequestTarget,
  init?: RequestInit,
  options: AuthFetchOptions = {}
): Promise<Response> => {
  const { requiresAuth = true, retryOnUnauthorized = true } = options;
  const response = await fetchWithCredentials(target, init);

  if (!requiresAuth || !retryOnUnauthorized || response.status !== 401 || isRefreshPath(target)) {
    return response;
  }

  const signal = init?.signal ?? undefined;
  throwIfAborted(signal);
  const refreshed = await refreshAccessToken(signal);
  throwIfAborted(signal);
  if (!refreshed) {
    notifySessionExpired();
    return response;
  }

  throwIfAborted(signal);
  const retriedResponse = await fetchWithCredentials(target, init);
  if (retriedResponse.status === 401) {
    clearAccessTokenExpiry();
    notifySessionExpired();
  }

  return retriedResponse;
};
