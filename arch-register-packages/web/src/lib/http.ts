import { ORPCError } from '@orpc/client';
import { fetchWithAuthResponse } from '../auth/authClient';

export type ApiErrorKind = 'http' | 'network' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly code?: string;
  readonly data?: unknown;

  constructor(
    public readonly status: number | undefined,
    message: string,
    options?: { kind?: ApiErrorKind; code?: string; cause?: unknown; data?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ApiError';
    this.kind = options?.kind ?? (status === undefined ? 'unknown' : 'http');
    this.code = options?.code;
    this.data = options?.data;
  }
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (error instanceof ORPCError) {
    return new ApiError(error.status, error.message, {
      kind: 'http',
      code: error.code,
      cause: error,
      data: error.data
    });
  }

  if (error instanceof TypeError) {
    return new ApiError(
      undefined,
      'Unable to reach the server. Check your connection and try again.',
      {
        kind: 'network',
        code: 'NETWORK_ERROR',
        cause: error
      }
    );
  }

  return new ApiError(
    undefined,
    error instanceof Error ? error.message : 'An unexpected request error occurred.',
    { kind: 'unknown', cause: error }
  );
};

const errorMessageFromResponse = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      const body = JSON.parse(text) as { message?: unknown };
      if (typeof body.message === 'string' && body.message.trim()) return body.message;
    } catch {
      return text;
    }
  }

  return response.statusText || `Request failed with status ${response.status}`;
};

export const ensureApiResponse = async (response: Response): Promise<Response> => {
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessageFromResponse(response));
  }
  return response;
};

export const apiFetchResponse = async (
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
) => {
  const headers = new Headers(init?.headers);
  if (
    !(typeof FormData !== 'undefined' && init?.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetchWithAuthResponse(path, { ...init, headers }, options);
    return await ensureApiResponse(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
): Promise<T> => {
  const res = await apiFetchResponse(path, init, options);
  return res.json();
};
