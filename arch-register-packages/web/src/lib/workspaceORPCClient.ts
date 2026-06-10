import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';

import { fetchWithAuthResponse } from '../auth/authClient';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { Workspace } from '@arch-register/api-types/workspaces';

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

const workspaceClientLink = new OpenAPILink(workspaceManagementContract, {
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

const workspaceClient: JsonifiedClient<ContractRouterClient<typeof workspaceManagementContract>> =
  createORPCClient(workspaceClientLink);

export const listWorkspacesORPC = async (): Promise<Workspace[]> =>
  await workspaceClient.workspaces.list({});

export const updateWorkspaceORPC = async (
  id: string,
  input: {
    name: string;
    description?: string;
    url_slug?: string;
    short_code?: string;
    color?: string;
  }
): Promise<Workspace> => await workspaceClient.workspaces.update({ id, ...input });

export const deleteWorkspaceORPC = async (
  id: string
): Promise<{ success: boolean; message: string }> =>
  await workspaceClient.workspaces.remove({ id });
