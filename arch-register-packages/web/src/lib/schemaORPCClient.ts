import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemas';

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

const schemaClientLink = new OpenAPILink(workspaceSchemaContract, {
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

const schemaClient: JsonifiedClient<ContractRouterClient<typeof workspaceSchemaContract>> =
  createORPCClient(schemaClientLink);

export const listWorkspaceSchemasORPC = async (workspace: string): Promise<EntitySchema[]> =>
  await schemaClient.schemas.list({ workspace });

export const createWorkspaceSchemaORPC = async (
  workspace: string,
  input: {
    name: string;
    description?: string;
    fields?: SchemaField[];
    color?: string | null;
    icon?: string | null;
    default_owner?: string | null;
  }
): Promise<EntitySchema> => await schemaClient.schemas.create({ workspace, ...input });

export const updateWorkspaceSchemaORPC = async (
  workspace: string,
  id: string,
  input: {
    name: string;
    description?: string;
    fields?: SchemaField[];
    color?: string | null;
    icon?: string | null;
    default_owner?: string | null;
  }
): Promise<EntitySchema> => await schemaClient.schemas.update({ workspace, id, ...input });

export const deleteWorkspaceSchemaORPC = async (
  workspace: string,
  id: string
): Promise<{ success: boolean; message: string }> =>
  await schemaClient.schemas.remove({ workspace, id });
