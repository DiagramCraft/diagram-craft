import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { projectContract } from '@arch-register/api-types/projectContract';
import { authPublicContract, authProtectedContract } from '@arch-register/api-types/authContract';
import { devContract } from '@arch-register/api-types/devContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import { workspaceCollectionContract } from '@arch-register/api-types/collectionContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { auditContract } from '@arch-register/api-types/auditContract';
import { watchContract } from '@arch-register/api-types/watchContract';
import { notificationPreferencesContract } from '@arch-register/api-types/notificationPreferencesContract';
import { discussionContract } from '@arch-register/api-types/discussionContract';
import { governanceContract } from '@arch-register/api-types/governanceContract';
import { governanceReminderConfigContract } from '@arch-register/api-types/governanceReminderConfigContract';
import { entityVersionContract } from '@arch-register/api-types/entityVersionContract';
import { entityChangeContract } from '@arch-register/api-types/entityChangeContract';
import { entityDeprecationContract } from '@arch-register/api-types/entityDeprecationContract';
import { assessmentContract } from '@arch-register/api-types/assessmentContract';
import { assessmentResponseContract } from '@arch-register/api-types/assessmentResponseContract';
import { milestoneContract } from '@arch-register/api-types/milestoneContract';
import { automationRuleContract } from '@arch-register/api-types/automationRuleContract';
import { externalContentContract } from '@arch-register/api-types/externalContentContract';
import { wikiCommentContract } from '@arch-register/api-types/wikiCommentContract';
import { aiContract } from '@arch-register/api-types/aiContract';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import { jobsContract } from '@arch-register/api-types/jobsContract';
import { webhookContract } from '@arch-register/api-types/webhookContract';
import { documentContract } from '@arch-register/api-types/documentContract';
import { changeCaseContract } from '@arch-register/api-types/changeCaseContract';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';
import { workspaceMetricContract } from '@arch-register/api-types/metricContract';

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
  const make = <T extends AnyContractRouter>(contract: T) => makeClient(contract, baseUrl, auth);
  const makeApplication = <T extends AnyContractRouter>(contract: T) =>
    makeClient(contract, baseUrl, auth, '/api/application/v1');
  const documents = makeApplication(documentContract);
  const applicationEntities = makeApplication(workspaceEntityContract).entities;
  const applicationSchemas = makeApplication(workspaceSchemaContract).schemas;
  const applicationProjects = makeApplication(projectContract).projects;
  const applicationSearch = makeApplication(searchContract).search;
  const applicationConfig = makeApplication(workspaceConfigContract).config;
  const applicationAi = makeApplication(aiContract).ai;
  const applicationEnums = makeApplication(workspaceEnumContract).enums;
  const applicationTemplates = makeApplication(workspaceTemplateContract).templates;
  const applicationViews = makeApplication(workspaceViewContract).views;
  const applicationCollections = makeApplication(workspaceCollectionContract).collections;
  const applicationAnalytics = makeApplication(workspaceAnalyticsContract).analytics;
  const applicationMetrics = makeApplication(workspaceMetricContract).metrics;
  const applicationJobs = makeApplication(jobsContract).jobs;
  const applicationWebhooks = makeApplication(webhookContract).webhooks;
  const applicationAudit = makeApplication(auditContract).audit;
  const applicationWatch = makeApplication(watchContract);
  const applicationNotificationPreferences = makeApplication(
    notificationPreferencesContract
  ).notificationPreferences;
  const applicationDiscussions = makeApplication(discussionContract).discussions;
  const applicationGovernance = makeApplication(governanceContract).governance;
  const applicationGovernanceReminderConfig = makeApplication(
    governanceReminderConfigContract
  ).governanceReminderConfig;
  const applicationEntityVersions = makeApplication(entityVersionContract).entityVersions;
  const applicationEntityChanges = makeApplication(entityChangeContract).entityChanges;
  const applicationEntityDeprecations =
    makeApplication(entityDeprecationContract).entityDeprecations;
  const applicationAssessments = makeApplication(assessmentContract).assessments;
  const applicationAssessmentResponses = makeApplication(
    assessmentResponseContract
  ).assessmentResponses;
  const applicationMilestones = makeApplication(milestoneContract).milestones;
  const applicationChangeCases = makeApplication(changeCaseContract).changeCases;
  const applicationAutomationRules = makeApplication(automationRuleContract).automationRules;
  const applicationExternalContent = makeApplication(externalContentContract).externalContent;
  const applicationWikiComments = makeApplication(wikiCommentContract).wikiComments;

  return {
    projects: applicationProjects,
    changeCases: applicationChangeCases,
    entityVersions: applicationEntityVersions,
    entityChanges: applicationEntityChanges,
    entityDeprecations: applicationEntityDeprecations,
    assessments: applicationAssessments,
    assessmentResponses: applicationAssessmentResponses,
    milestones: applicationMilestones,
    automationRules: applicationAutomationRules,
    externalContent: applicationExternalContent,
    wikiComments: applicationWikiComments,
    auth: make(authPublicContract).auth,
    authProtected: make(authProtectedContract).authProtected,
    dev: make(devContract).dev,
    entities: applicationEntities,
    entityQueryText: make(workspaceEntityContract).entityQueryText,
    enums: applicationEnums,
    schemas: applicationSchemas,
    search: applicationSearch,
    templates: applicationTemplates,
    views: applicationViews,
    collections: applicationCollections,
    workspaces: makeApplication(workspaceManagementContract).workspaces,
    config: applicationConfig,
    analytics: applicationAnalytics,
    metrics: applicationMetrics,
    audit: applicationAudit,
    watching: applicationWatch.watching,
    notifications: applicationWatch.notifications,
    notificationPreferences: applicationNotificationPreferences,
    discussions: applicationDiscussions,
    governance: applicationGovernance,
    governanceReminderConfig: applicationGovernanceReminderConfig,
    ai: applicationAi,
    diagramCraft: make(diagramCraftContract).diagramCraft,
    jobs: applicationJobs,
    webhooks: applicationWebhooks,
    documents
  };
};

export type TestORPCClient = ReturnType<typeof createTestORPCClient>;
