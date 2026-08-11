import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contractSurfaceManifest } from '@arch-register/api-types/contractSurfaceManifest';
import { fetchWithAuthResponse } from '../auth/authClient';
import { resolveApiUrl } from './apiUrl';
import { normalizeApiError } from './http';

const CORE_API_PATH = '/api';
const APPLICATION_API_PATH = '/api/application/v1';
const PUBLIC_CATALOG_API_PATH = '/api/public/v1';

const resolveORPCBaseUrl = (apiPath: string) => resolveApiUrl(apiPath);

const { core, application, diagramCraft } = contractSurfaceManifest.surfaces;

const fetchApiRequest = async (
  request: Request,
  init?: RequestInit,
  options?: { signal?: AbortSignal }
) => {
  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD' || request.body === null
      ? undefined
      : await request.clone().arrayBuffer();
  const nextInit: RequestInit = {
    ...init,
    method,
    headers: new Headers(request.headers),
    body,
    signal: options?.signal ?? init?.signal ?? request.signal
  };

  return fetchWithAuthResponse(request.url, nextInit);
};

const createApiClient = <T extends AnyContractRouter>(contracts: T, apiPath: string) => {
  const clientLink = new OpenAPILink(contracts, {
    url: () => resolveORPCBaseUrl(apiPath),
    interceptors: [
      async options => {
        try {
          return await options.next();
        } catch (error) {
          if (options.signal?.aborted) throw error;
          throw normalizeApiError(error);
        }
      }
    ],
    fetch: fetchApiRequest
  });

  return createORPCClient(clientLink) as JsonifiedClient<ContractRouterClient<T>>;
};

const coreClient = createApiClient(core.contracts, CORE_API_PATH);
const applicationClient = createApiClient(application.contracts, APPLICATION_API_PATH);
const diagramCraftClient = createApiClient(diagramCraft.contracts, CORE_API_PATH);

type FirstPartyWebContractRouter = typeof core.contracts &
  typeof application.contracts &
  typeof diagramCraft.contracts;
type FirstPartyWebClient = JsonifiedClient<ContractRouterClient<FirstPartyWebContractRouter>>;

const mergeClientSurfaces = (
  surfaces: readonly {
    contracts: AnyContractRouter;
    client: object;
  }[]
) => {
  const merged: Record<string, unknown> = {};

  for (const { contracts, client } of surfaces) {
    for (const key of Object.keys(contracts)) {
      if (key in merged) {
        throw new Error(`Duplicate oRPC client router key "${key}"`);
      }
      merged[key] = (client as Record<string, unknown>)[key];
    }
  }

  return merged;
};

export const publicCatalogOpenAPISpecUrl = () => resolveORPCBaseUrl('/api/public/v1/openapi.json');

export const publicCatalogRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(resolveApiUrl(`${PUBLIC_CATALOG_API_PATH}${path}`), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    let message = `Public catalog request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
};

// Keep the first-party web client in lockstep with the manifest. Core and Diagram Craft
// routes are mounted under /api, while application routes use /api/application/v1.
// Integration and public-catalog routes intentionally use dedicated clients.
export const orpcClient: FirstPartyWebClient = {
  ...mergeClientSurfaces([
    { contracts: core.contracts, client: coreClient },
    { contracts: application.contracts, client: applicationClient },
    { contracts: diagramCraft.contracts, client: diagramCraftClient }
  ])
} as FirstPartyWebClient;
