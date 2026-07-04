import { fetchWithAuthResponse } from '../auth/authClient';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const apiFetchResponse = async (
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init?.headers
  };
  const res = await fetchWithAuthResponse(path, { ...init, headers }, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res;
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
): Promise<T> => {
  const res = await apiFetchResponse(path, init, options);
  return res.json();
};
