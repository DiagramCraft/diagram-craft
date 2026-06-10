import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { searchContract } from '@arch-register/api-types/searchContract';

const ORPC_BASE_PATH = '/api';

const resolveORPCBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_URL ?? '';

  if (configuredBase) {
    return new URL(ORPC_BASE_PATH, configuredBase).toString();
  }

  if (typeof window !== 'undefined') {
    return new URL(ORPC_BASE_PATH, window.location.origin).toString();
  }

  return `http://localhost${ORPC_BASE_PATH}`;
};

const searchClientLink = new OpenAPILink(searchContract, {
  url: resolveORPCBaseUrl,
  fetch: async (request, init) => {
    const raw = request.url;
    const method = request.method;
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.clone().text();
    const nextInit: RequestInit = { ...init, method, headers: request.headers, body };

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw);
      return fetchWithAuthResponse(`${url.pathname}${url.search}`, nextInit);
    }

    return fetchWithAuthResponse(raw, nextInit);
  }
});

const searchClient: JsonifiedClient<ContractRouterClient<typeof searchContract>> =
  createORPCClient(searchClientLink);

export const searchArchRegisterORPC = async (
  workspace: string,
  params: {
    q?: string;
    limitPerType?: number | null;
    types?: Array<'projects' | 'files' | 'entities' | 'schemas'> | null;
  }
) =>
  await searchClient.search.query({
    workspace,
    q: params.q ?? undefined,
    limitPerType: params.limitPerType ?? undefined,
    types: params.types?.join(',') ?? undefined
  });
