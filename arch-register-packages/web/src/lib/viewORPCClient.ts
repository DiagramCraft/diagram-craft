import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { workspaceViewContract } from '@arch-register/api-types';
import type { SavedView } from '@arch-register/api-types/views';
import type { PinnedEntity } from '@arch-register/api-types';
import { fetchWithAuthResponse } from '../auth/authClient';

const ORPC_BASE_PATH = '/api/poc-orpc';

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

const viewClientLink = new OpenAPILink(workspaceViewContract, {
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

const viewClient: JsonifiedClient<ContractRouterClient<typeof workspaceViewContract>> =
  createORPCClient(viewClientLink);

export const listSavedViewsORPC = async (workspace: string): Promise<SavedView[]> =>
  await viewClient.views.list({ workspace });

export const listPinnedEntitiesORPC = async (workspace: string): Promise<PinnedEntity[]> =>
  await viewClient.pinnedEntities.list({ workspace });
