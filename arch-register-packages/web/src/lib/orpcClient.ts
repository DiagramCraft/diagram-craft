import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contractSurfaceManifest } from '@arch-register/api-types/contractSurfaceManifest';
import { fetchWithAuthResponse } from '../auth/authClient';
import { normalizeApiError } from './http';

const CORE_API_PATH = '/api';
const APPLICATION_API_PATH = '/api/application/v1';
const PUBLIC_CATALOG_API_PATH = '/api/public/v1';

const resolveORPCBaseUrl = (apiPath: string) => {
  const configuredBase = import.meta.env.VITE_API_URL ?? '';

  if (configuredBase) {
    return new URL(apiPath, configuredBase).toString();
  }

  if (typeof window !== 'undefined') {
    return new URL(apiPath, window.location.origin).toString();
  }

  return `http://localhost${apiPath}`;
};

const { core, application, diagramCraft } = contractSurfaceManifest.surfaces;

const fetchApiRequest = async (request: Request, init?: RequestInit) => {
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.clone().text();
  const nextInit: RequestInit = { ...init, method, headers: request.headers, body };
  const url = new URL(request.url);

  return fetchWithAuthResponse(`${url.pathname}${url.search}`, nextInit);
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

export const publicCatalogOpenAPISpecUrl = () => resolveORPCBaseUrl('/api/public/v1/openapi.json');

export const publicCatalogRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${resolveORPCBaseUrl(PUBLIC_CATALOG_API_PATH)}${path}`, {
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

export const orpcClient = {
  auth: coreClient.auth,
  authProtected: coreClient.authProtected,
  dev: coreClient.dev,
  diagramCraft: diagramCraftClient.diagramCraft,
  ai: applicationClient.ai,
  analytics: applicationClient.analytics,
  metrics: applicationClient.metrics,
  jobs: applicationClient.jobs,
  externalContent: applicationClient.externalContent,
  webhooks: applicationClient.webhooks,
  automationRules: applicationClient.automationRules,
  documentTypes: applicationClient.documentTypes,
  documentTemplates: applicationClient.documentTemplates,
  entityChanges: applicationClient.entityChanges,
  entityDeprecations: applicationClient.entityDeprecations,
  governance: applicationClient.governance,
  governanceWorkflowConfig: applicationClient.governanceWorkflowConfig,
  artifacts: applicationClient.artifacts,
  enums: applicationClient.enums,
  fieldGroups: applicationClient.fieldGroups,
  schemas: applicationClient.schemas,
  relationSchemas: applicationClient.relationSchemas,
  relations: applicationClient.relations,
  entities: applicationClient.entities,
  entityQueryText: applicationClient.entityQueryText,
  entityVersions: applicationClient.entityVersions,
  views: applicationClient.views,
  dashboards: applicationClient.dashboards,
  personalDashboards: applicationClient.personalDashboards,
  projectDashboard: applicationClient.projectDashboard,
  collections: applicationClient.collections,
  workspaces: applicationClient.workspaces,
  config: applicationClient.config,
  publicCatalogConfig: applicationClient.publicCatalogConfig,
  projects: applicationClient.projects,
  milestones: applicationClient.milestones,
  changeCases: applicationClient.changeCases,
  assessments: applicationClient.assessments,
  assessmentResponses: applicationClient.assessmentResponses,
  audit: applicationClient.audit,
  watching: applicationClient.watching,
  notifications: applicationClient.notifications,
  pinnedEntities: applicationClient.pinnedEntities,
  notificationPreferences: applicationClient.notificationPreferences,
  discussions: applicationClient.discussions,
  wikiComments: applicationClient.wikiComments,
  search: applicationClient.search,
  templates: applicationClient.templates,
  baselines: applicationClient.baselines
};
