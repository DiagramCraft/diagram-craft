import type { ContractRouterClient } from '@orpc/contract';
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
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { projectContract } from '@arch-register/api-types/projectContract';
import { milestoneContract } from '@arch-register/api-types/milestoneContract';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
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
import { fetchWithAuthResponse } from '../auth/authClient';
import { normalizeApiError } from './http';

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
  ...aiContract,
  ...authPublicContract,
  ...authProtectedContract,
  ...devContract,
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
  ...diagramCraftContract,
  ...workspaceEnumContract,
  ...workspaceSchemaContract,
  ...workspaceEntityContract,
  ...workspaceViewContract,
  ...workspaceCollectionContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...milestoneContract,
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

const clientLink = new OpenAPILink(webContracts, {
  url: resolveORPCBaseUrl,
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
