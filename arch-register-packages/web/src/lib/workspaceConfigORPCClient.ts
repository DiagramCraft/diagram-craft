import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';

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

const configClientLink = new OpenAPILink(workspaceConfigContract, {
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

const configClient: JsonifiedClient<ContractRouterClient<typeof workspaceConfigContract>> =
  createORPCClient(configClientLink);

export const listLifecycleStatesORPC = async (workspace: string) =>
  await configClient.config.lifecycleStates.list({ params: { workspace } });

export const updateLifecycleStatesORPC = async (
  workspace: string,
  states: Array<{ id?: string; label: string; color: string; sort_order?: number }>
) => await configClient.config.lifecycleStates.replace({ params: { workspace }, body: { states } });

export const listTeamsORPC = async (workspace: string) =>
  await configClient.config.teams.list({ params: { workspace } });

export const updateTeamsORPC = async (
  workspace: string,
  teams: Array<{
    id?: string;
    name: string;
    sort_order?: number;
    color?: string | null;
    description?: string;
  }>
) => await configClient.config.teams.replace({ params: { workspace }, body: { teams } });

export const listTeamAssignmentsORPC = async (workspace: string) =>
  await configClient.config.teamAssignments.list({ params: { workspace } });

export const updateTeamAssignmentsORPC = async (
  workspace: string,
  assignments: Array<{
    team_id: string;
    user_id: string;
    role: 'team_admin' | 'team_editor' | 'team_reviewer';
  }>
) =>
  await configClient.config.teamAssignments.replace({
    params: { workspace },
    body: { assignments }
  });
