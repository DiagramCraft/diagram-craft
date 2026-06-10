import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { ProjectTemplatesResponse } from '@arch-register/api-types/projects';

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

const templateClientLink = new OpenAPILink(workspaceTemplateContract, {
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

const templateClient: JsonifiedClient<ContractRouterClient<typeof workspaceTemplateContract>> =
  createORPCClient(templateClientLink);

export const listProjectTemplatesORPC = async (
  workspace: string,
  projectId: string
): Promise<ProjectTemplatesResponse> =>
  await templateClient.templates.listForProject({ workspace, projectId });
