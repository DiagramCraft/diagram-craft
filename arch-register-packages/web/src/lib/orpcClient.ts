import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { auditContract } from '@arch-register/api-types/auditContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { projectContract } from '@arch-register/api-types/projectContract';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import { watchContract } from '@arch-register/api-types/watchContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { fetchWithAuthResponse } from '../auth/authClient';

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

const webContracts = {
  ...workspaceEnumContract,
  ...workspaceSchemaContract,
  ...workspaceEntityContract,
  ...workspaceViewContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...auditContract,
  ...watchContract,
  ...searchContract,
  ...workspaceTemplateContract
};

const clientLink = new OpenAPILink(webContracts, {
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

export const orpcClient: JsonifiedClient<ContractRouterClient<typeof webContracts>> =
  createORPCClient(clientLink);
