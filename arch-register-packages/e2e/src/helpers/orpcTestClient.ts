import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { contractSurfaceManifest } from '@arch-register/api-types/contractSurfaceManifest';

const makeFetch =
  (auth?: string) =>
  async (request: Request, init?: RequestInit): Promise<Response> => {
    const method = request.method;
    const body =
      method === 'GET' || method === 'HEAD' ? undefined : await request.clone().arrayBuffer();
    const headers = new Headers(request.headers);
    if (auth) headers.set('Authorization', auth);
    return fetch(request.url, { ...init, method, headers, body });
  };

const makeClient = <T extends AnyContractRouter>(
  contract: T,
  baseUrl: string,
  auth?: string,
  apiPrefix = '/api'
) =>
  createORPCClient(
    new OpenAPILink(contract, { url: `${baseUrl}${apiPrefix}`, fetch: makeFetch(auth) })
  ) as JsonifiedClient<ContractRouterClient<T>>;

export const createTestORPCClient = (baseUrl: string, auth?: string) => {
  const { core, application, diagramCraft } = contractSurfaceManifest.surfaces;
  const coreClient = makeClient(core.contracts, baseUrl, auth);
  const applicationClient = makeClient(application.contracts, baseUrl, auth, '/api/application/v1');
  const diagramCraftClient = makeClient(diagramCraft.contracts, baseUrl, auth);

  return {
    projects: applicationClient.projects,
    changeCases: applicationClient.changeCases,
    entityVersions: applicationClient.entityVersions,
    entityChanges: applicationClient.entityChanges,
    entityDeprecations: applicationClient.entityDeprecations,
    entityMerges: applicationClient.entityMerges,
    assessments: applicationClient.assessments,
    assessmentResponses: applicationClient.assessmentResponses,
    milestones: applicationClient.milestones,
    automationRules: applicationClient.automationRules,
    externalContent: applicationClient.externalContent,
    wikiComments: applicationClient.wikiComments,
    artifacts: applicationClient.artifacts,
    baselines: applicationClient.baselines,
    auth: coreClient.auth,
    authProtected: coreClient.authProtected,
    dev: coreClient.dev,
    entities: applicationClient.entities,
    relations: applicationClient.relations,
    relationSchemas: applicationClient.relationSchemas,
    entityQueryText: applicationClient.entityQueryText,
    enums: applicationClient.enums,
    fieldGroups: applicationClient.fieldGroups,
    categories: applicationClient.categories,
    schemas: applicationClient.schemas,
    search: applicationClient.search,
    templates: applicationClient.templates,
    views: applicationClient.views,
    collections: applicationClient.collections,
    workspaces: applicationClient.workspaces,
    config: applicationClient.config,
    glossary: applicationClient.glossary,
    publicCatalogConfig: applicationClient.publicCatalogConfig,
    analytics: applicationClient.analytics,
    metrics: applicationClient.metrics,
    dashboard: applicationClient.dashboards,
    projectDashboard: applicationClient.projectDashboard,
    audit: applicationClient.audit,
    watching: applicationClient.watching,
    notifications: applicationClient.notifications,
    notificationPreferences: applicationClient.notificationPreferences,
    discussions: applicationClient.discussions,
    governance: applicationClient.governance,
    governanceWorkflowConfig: applicationClient.governanceWorkflowConfig,
    ai: applicationClient.ai,
    diagramCraft: diagramCraftClient.diagramCraft,
    jobs: applicationClient.jobs,
    webhooks: applicationClient.webhooks,
    documents: {
      documentTypes: applicationClient.documentTypes,
      documentTemplates: applicationClient.documentTemplates
    }
  };
};

export type TestORPCClient = ReturnType<typeof createTestORPCClient>;
