import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { WorkspaceEnum } from '@arch-register/api-types/schemas';

const ORPC_ENUMS_BASE_PATH = '/api';

const resolveORPCBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_URL ?? '';

  if (configuredBase) {
    return new URL(ORPC_ENUMS_BASE_PATH, configuredBase).toString();
  }

  if (typeof window !== 'undefined') {
    return new URL(ORPC_ENUMS_BASE_PATH, window.location.origin).toString();
  }

  return `http://localhost${ORPC_ENUMS_BASE_PATH}`;
};

const enumClientLink = new OpenAPILink(workspaceEnumContract, {
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

const enumClient: JsonifiedClient<ContractRouterClient<typeof workspaceEnumContract>> =
  createORPCClient(enumClientLink);

export const listWorkspaceEnumsORPC = async (workspace: string): Promise<WorkspaceEnum[]> =>
  await enumClient.enums.list({ workspace });

export const createWorkspaceEnumORPC = async (
  workspace: string,
  input: {
    name: string;
    options?: Array<{ value: string; label: string }>;
    sort_order?: number;
  }
): Promise<WorkspaceEnum> => await enumClient.enums.create({ workspace, ...input });

export const updateWorkspaceEnumORPC = async (
  workspace: string,
  id: string,
  input: {
    name: string;
    options?: Array<{ value: string; label: string }>;
    sort_order?: number;
  }
): Promise<WorkspaceEnum> => await enumClient.enums.update({ workspace, id, ...input });

export const deleteWorkspaceEnumORPC = async (
  workspace: string,
  id: string
): Promise<{ success: boolean; message: string }> =>
  await enumClient.enums.remove({ workspace, id });
