import { defineHandler } from 'h3';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { workspaceRelationSchemaContract } from '@arch-register/api-types/relationSchemaContract';
import { workspaceRelationContract } from '@arch-register/api-types/relationContract';
import { integrationRelationContract } from '@arch-register/api-types/integrationRelationContract';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';
import { workspaceFieldGroupContract } from '@arch-register/api-types/fieldGroupContract';
import { workspaceEntityContract } from '@arch-register/api-types/entityContract';
import { entitySyncContract } from '@arch-register/api-types/entitySyncContract';
import { relationSyncContract } from '@arch-register/api-types/relationSyncContract';
import { projectContract } from '@arch-register/api-types/projectContract';
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import {
  workspaceDashboardContract,
  projectDashboardContract
} from '@arch-register/api-types/dashboardContract';
import { workspaceCollectionContract } from '@arch-register/api-types/collectionContract';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { auditContract } from '@arch-register/api-types/auditContract';
import { watchContract } from '@arch-register/api-types/watchContract';
import { notificationPreferencesContract } from '@arch-register/api-types/notificationPreferencesContract';
import { searchContract } from '@arch-register/api-types/searchContract';
import { workspaceTemplateContract } from '@arch-register/api-types/templateContract';
import { authProtectedContract, authPublicContract } from '@arch-register/api-types/authContract';
import { aiContract } from '@arch-register/api-types/aiContract';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import { workspaceAnalyticsContract } from '@arch-register/api-types/analyticsContract';
import { workspaceMetricContract } from '@arch-register/api-types/metricContract';
import { jobsContract } from '@arch-register/api-types/jobsContract';
import { externalContentContract } from '@arch-register/api-types/externalContentContract';
import { webhookContract } from '@arch-register/api-types/webhookContract';
import { documentContract } from '@arch-register/api-types/documentContract';
import { assessmentContract } from '@arch-register/api-types/assessmentContract';
import { assessmentResponseContract } from '@arch-register/api-types/assessmentResponseContract';
import { automationRuleContract } from '@arch-register/api-types/automationRuleContract';
import { changeCaseContract } from '@arch-register/api-types/changeCaseContract';
import { discussionContract } from '@arch-register/api-types/discussionContract';
import { entityChangeContract } from '@arch-register/api-types/entityChangeContract';
import { entityDeprecationContract } from '@arch-register/api-types/entityDeprecationContract';
import { entityVersionContract } from '@arch-register/api-types/entityVersionContract';
import { relationVersionContract } from '@arch-register/api-types/relationVersionContract';
import { relationChangeContract } from '@arch-register/api-types/relationChangeContract';
import { governanceContract } from '@arch-register/api-types/governanceContract';
import { governanceReminderConfigContract } from '@arch-register/api-types/governanceReminderConfigContract';
import { governanceWorkflowOverviewContract } from '@arch-register/api-types/governanceWorkflowOverviewContract';
import { governanceDocumentStatusConfigContract } from '@arch-register/api-types/governanceDocumentStatusConfigContract';
import { milestoneContract } from '@arch-register/api-types/milestoneContract';
import { wikiCommentContract } from '@arch-register/api-types/wikiCommentContract';
import { devContract } from '@arch-register/api-types/devContract';

export const allContracts = {
  ...workspaceEnumContract,
  ...workspaceFieldGroupContract,
  ...workspaceSchemaContract,
  ...workspaceRelationSchemaContract,
  ...workspaceRelationContract,
  ...workspaceEntityContract,
  ...entitySyncContract,
  ...relationSyncContract,
  ...workspaceViewContract,
  ...workspaceDashboardContract,
  ...projectDashboardContract,
  ...workspaceCollectionContract,
  ...workspaceManagementContract,
  ...workspaceConfigContract,
  ...projectContract,
  ...auditContract,
  ...watchContract,
  ...notificationPreferencesContract,
  ...searchContract,
  ...workspaceTemplateContract,
  ...authPublicContract,
  ...authProtectedContract,
  ...aiContract,
  ...diagramCraftContract,
  ...workspaceAnalyticsContract,
  ...workspaceMetricContract,
  ...jobsContract,
  ...externalContentContract,
  ...webhookContract,
  ...documentContract,
  ...assessmentContract,
  ...assessmentResponseContract,
  ...automationRuleContract,
  ...changeCaseContract,
  ...discussionContract,
  ...entityChangeContract,
  ...entityDeprecationContract,
  ...entityVersionContract,
  ...relationVersionContract,
  ...relationChangeContract,
  ...governanceContract,
  ...governanceReminderConfigContract,
  ...governanceWorkflowOverviewContract,
  ...governanceDocumentStatusConfigContract,
  ...milestoneContract,
  ...wikiCommentContract,
  ...devContract
};

const coreContracts = {
  ...authPublicContract,
  ...authProtectedContract,
  ...devContract
};

let generatedUnifiedSpec: Promise<object> | null = null;
let generatedApplicationSpec: Promise<object> | null = null;
let generatedIntegrationSpec: Promise<object> | null = null;
let generatedDiagramCraftAdapterSpec: Promise<object> | null = null;

export const getUnifiedOpenAPISpec = () => {
  generatedUnifiedSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(coreContracts, {
    info: {
      title: 'Arch Register API',
      version: '1.0.0'
    },
    servers: [{ url: '/api' }]
  });

  return generatedUnifiedSpec;
};

export const getApplicationOpenAPISpec = () => {
  generatedApplicationSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(
    {
      ...workspaceSchemaContract,
      ...workspaceRelationSchemaContract,
      ...workspaceRelationContract,
      ...workspaceEntityContract,
      ...workspaceManagementContract,
      ...projectContract,
      ...workspaceConfigContract,
      ...searchContract,
      ...aiContract,
      ...workspaceEnumContract,
      ...workspaceFieldGroupContract,
      ...workspaceViewContract,
      ...workspaceDashboardContract,
      ...projectDashboardContract,
      ...workspaceCollectionContract,
      ...workspaceTemplateContract,
      ...auditContract,
      ...watchContract,
      ...notificationPreferencesContract,
      ...discussionContract,
      ...governanceContract,
      ...governanceReminderConfigContract,
      ...governanceWorkflowOverviewContract,
      ...governanceDocumentStatusConfigContract,
      ...entityVersionContract,
      ...entityChangeContract,
      ...relationVersionContract,
      ...relationChangeContract,
      ...entityDeprecationContract,
      ...assessmentContract,
      ...assessmentResponseContract,
      ...milestoneContract,
      ...changeCaseContract,
      ...automationRuleContract,
      ...externalContentContract,
      ...wikiCommentContract,
      ...workspaceAnalyticsContract,
      ...workspaceMetricContract,
      ...jobsContract,
      ...webhookContract,
      ...documentContract
    },
    {
      info: {
        title: 'Arch Register Application API',
        version: '1.0.0'
      },
      servers: [{ url: '/api/application/v1' }]
    }
  );

  return generatedApplicationSpec;
};

export const getIntegrationOpenAPISpec = () => {
  const integrationSchemaContract = {
    schemas: {
      list: workspaceSchemaContract.schemas.list
    }
  };

  generatedIntegrationSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  })
    .generate(
      {
        ...integrationSchemaContract,
        ...integrationRelationContract,
        ...entitySyncContract,
        ...relationSyncContract
      },
      {
        info: {
          title: 'Arch Register Integration API',
          version: '1.0.0'
        },
        servers: [{ url: '/api' }]
      }
    )
    .then(spec => {
      const paths = Object.fromEntries(
        Object.entries((spec as { paths?: Record<string, unknown> }).paths ?? {}).map(
          ([path, operations]) => [
            path === '/{workspace}/schemas' ? `/integrations/v1${path}` : path,
            operations
          ]
        )
      );

      return { ...spec, paths };
    });

  return generatedIntegrationSpec;
};

export const getDiagramCraftAdapterOpenAPISpec = () => {
  generatedDiagramCraftAdapterSpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  })
    .generate(diagramCraftContract, {
      info: {
        title: 'Diagram Craft Adapter API',
        version: '1.0.0'
      },
      servers: [{ url: '/api' }]
    })
    .then(spec => {
      const paths = Object.fromEntries(
        Object.entries((spec as { paths?: Record<string, unknown> }).paths ?? {}).filter(([path]) =>
          path.startsWith('/adapters/diagram-craft/')
        )
      );

      return { ...spec, paths };
    });

  return generatedDiagramCraftAdapterSpec;
};

const createOpenAPISpecHandler = (getSpec: () => Promise<object>) =>
  defineHandler(async () => Response.json(await getSpec()));

export const createUnifiedOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getUnifiedOpenAPISpec);

export const createApplicationOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getApplicationOpenAPISpec);

export const createIntegrationOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getIntegrationOpenAPISpec);

export const createDiagramCraftAdapterOpenAPISpecHandler = () =>
  createOpenAPISpecHandler(getDiagramCraftAdapterOpenAPISpec);
