import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { aiContract } from '@arch-register/api-types/aiContract';
import { assessmentContract } from '@arch-register/api-types/assessmentContract';
import { assessmentResponseContract } from '@arch-register/api-types/assessmentResponseContract';
import { auditContract } from '@arch-register/api-types/auditContract';
import { authProtectedContract, authPublicContract } from '@arch-register/api-types/authContract';
import { devContract } from '@arch-register/api-types/devContract';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { entityVersionContract } from '@arch-register/api-types/entityVersionContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { projectContract } from '@arch-register/api-types/projectContract';
import { milestoneContract } from '@arch-register/api-types/milestoneContract';
import { changeCaseContract } from '@arch-register/api-types/changeCaseContract';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { workspaceRelationSchemaContract } from '@arch-register/api-types/relationSchemaContract';
import { workspaceRelationContract } from '@arch-register/api-types/relationContract';
import { workspaceFieldGroupContract } from '@arch-register/api-types/fieldGroupContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import {
  workspaceDashboardContract,
  personalDashboardContract,
  projectDashboardContract
} from '@arch-register/api-types/dashboardContract';
import { workspaceCollectionContract } from '@arch-register/api-types/collectionContract';
import { watchContract } from '@arch-register/api-types/watchContract';
import { notificationPreferencesContract } from '@arch-register/api-types/notificationPreferencesContract';
import { discussionContract } from '@arch-register/api-types/discussionContract';
import { wikiCommentContract } from '@arch-register/api-types/wikiCommentContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';
import { workspaceMetricContract } from '@arch-register/api-types/metricContract';
import { jobsContract } from '@arch-register/api-types/jobsContract';
import { externalContentContract } from '@arch-register/api-types/externalContentContract';
import { webhookContract } from '@arch-register/api-types/webhookContract';
import { automationRuleContract } from '@arch-register/api-types/automationRuleContract';
import { documentContract } from '@arch-register/api-types/documentContract';
import { entityChangeContract } from '@arch-register/api-types/entityChangeContract';
import { entityDeprecationContract } from '@arch-register/api-types/entityDeprecationContract';
import { governanceContract } from '@arch-register/api-types/governanceContract';
import { governanceReminderConfigContract } from '@arch-register/api-types/governanceReminderConfigContract';
import { governanceWorkflowOverviewContract } from '@arch-register/api-types/governanceWorkflowOverviewContract';
import { fetchWithAuthResponse } from '../auth/authClient';
import { normalizeApiError } from './http';

const CORE_API_PATH = '/api';
const APPLICATION_API_PATH = '/api/application/v1';

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

const coreContracts = {
  ...authPublicContract,
  ...authProtectedContract,
  ...devContract,
  ...diagramCraftContract
};

const applicationContracts = {
  ...workspaceFieldGroupContract,
  ...aiContract,
  ...workspaceAnalyticsContract,
  ...workspaceMetricContract,
  ...jobsContract,
  ...externalContentContract,
  ...webhookContract,
  ...automationRuleContract,
  ...documentContract,
  ...entityChangeContract,
  ...entityDeprecationContract,
  ...governanceContract,
  ...governanceReminderConfigContract,
  ...governanceWorkflowOverviewContract,
  ...workspaceEnumContract,
  ...workspaceSchemaContract,
  ...workspaceRelationSchemaContract,
  ...workspaceRelationContract,
  ...workspaceEntityContract,
  ...entityVersionContract,
  ...workspaceViewContract,
  ...workspaceDashboardContract,
  ...personalDashboardContract,
  ...projectDashboardContract,
  ...workspaceCollectionContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...milestoneContract,
  ...changeCaseContract,
  ...assessmentContract,
  ...assessmentResponseContract,
  ...auditContract,
  ...watchContract,
  ...notificationPreferencesContract,
  ...discussionContract,
  ...wikiCommentContract,
  ...searchContract,
  ...workspaceTemplateContract
};

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

const coreClient = createApiClient(coreContracts, CORE_API_PATH);
const applicationClient = createApiClient(applicationContracts, APPLICATION_API_PATH);

export const orpcClient = {
  auth: coreClient.auth,
  authProtected: coreClient.authProtected,
  dev: coreClient.dev,
  diagramCraft: coreClient.diagramCraft,
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
  governanceReminderConfig: applicationClient.governanceReminderConfig,
  governanceWorkflowOverview: applicationClient.governanceWorkflowOverview,
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
  templates: applicationClient.templates
};
