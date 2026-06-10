import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { projectContract } from '@arch-register/api-types/projectContract';
import { Project, ProjectDetail } from '@arch-register/api-types/projectContract';

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

const projectClientLink = new OpenAPILink(projectContract, {
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

const projectClient: JsonifiedClient<ContractRouterClient<typeof projectContract>> =
  createORPCClient(projectClientLink);

export const listProjectsORPC = async (workspace: string): Promise<Project[]> =>
  await projectClient.projects.list({ workspace });

export const getProjectORPC = async (workspace: string, id: string): Promise<ProjectDetail> =>
  await projectClient.projects.get({ workspace, id });

export const createProjectORPC = async (
  workspace: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
  }
): Promise<Project> => await projectClient.projects.create({ workspace, ...input });

export const updateProjectORPC = async (
  workspace: string,
  id: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
  }
): Promise<Project> => await projectClient.projects.update({ workspace, id, ...input });

export const deleteProjectORPC = async (
  workspace: string,
  id: string
): Promise<{ success: boolean; message: string }> =>
  await projectClient.projects.remove({ workspace, id });
