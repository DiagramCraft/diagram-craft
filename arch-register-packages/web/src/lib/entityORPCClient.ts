import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import {
  workspaceEntityContract,
  type EntityRecord,
  type EntityFacets,
  type EntityRelations
} from '@arch-register/api-types';
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

const entityClientLink = new OpenAPILink(workspaceEntityContract, {
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

const entityClient: JsonifiedClient<ContractRouterClient<typeof workspaceEntityContract>> =
  createORPCClient(entityClientLink);

export const listEntitiesORPC = async (
  workspace: string,
  options: {
    _schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    view?: 'summary' | 'full';
    limit?: number | null;
    offset?: number | null;
  } = {}
): Promise<EntityRecord[]> =>
  await entityClient.entities.list({
    workspace,
    _schemaId: options._schemaId ?? undefined,
    owner: options.owner ?? undefined,
    lifecycle: options.lifecycle ?? undefined,
    q: options.q ?? undefined,
    view: options.view,
    limit: options.limit ?? undefined,
    offset: options.offset ?? undefined
  });

export const getEntityFacetsORPC = async (workspace: string): Promise<EntityFacets> =>
  await entityClient.entities.facets({ workspace });

export const getEntityORPC = async (workspace: string, id: string): Promise<EntityRecord> =>
  await entityClient.entities.get({ workspace, id });

export const getEntityRelationsORPC = async (
  workspace: string,
  id: string
): Promise<EntityRelations> => await entityClient.entities.relations({ workspace, id });

export const getEntityTreeORPC = async (
  workspace: string,
  options: {
    _schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
  } = {}
) =>
  await entityClient.entities.tree({
    workspace,
    _schemaId: options._schemaId ?? undefined,
    owner: options.owner ?? undefined,
    lifecycle: options.lifecycle ?? undefined,
    q: options.q ?? undefined
  });

export const updateEntityORPC = async (
  workspace: string,
  id: string,
  data: Record<string, unknown>
): Promise<EntityRecord> => await entityClient.entities.update({ workspace, id, ...data });

export const deleteEntityORPC = async (
  workspace: string,
  id: string
): Promise<{ success: boolean; message: string }> =>
  await entityClient.entities.remove({ workspace, id });

export const cloneEntityORPC = async (workspace: string, id: string): Promise<EntityRecord> =>
  await entityClient.entities.clone({ workspace, id });
