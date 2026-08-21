import type { AnyContractRouter } from '@orpc/contract';
import { aiContract } from './aiContract';
import { apiSpecificationSyncContract } from './apiSpecificationSyncContract';
import { artifactContract } from './artifactContract';
import { assessmentContract } from './assessmentContract';
import { assessmentResponseContract } from './assessmentResponseContract';
import { auditContract } from './auditContract';
import { authProtectedContract, authPublicContract } from './authContract';
import { automationRuleContract } from './automationRuleContract';
import { baselineContract } from './baselineContract';
import { changeCaseContract } from './changeCaseContract';
import { workspaceCollectionContract } from './collectionContract';
import { conformanceContract } from './conformanceContract';
import {
  personalDashboardContract,
  projectDashboardContract,
  workspaceDashboardContract
} from './dashboardContract';
import { devContract } from './devContract';
import { diagramCraftContract } from './diagramCraftContract';
import { discussionContract } from './discussionContract';
import { documentContract } from './documentContract';
import { entityChangeContract } from './entityChangeContract';
import { workspaceEntityContract } from './entityContract';
import { entityDeprecationContract } from './entityDeprecationContract';
import { entitySyncContract } from './entitySyncContract';
import { entityVersionContract } from './entityVersionContract';
import { workspaceEnumContract } from './enumContract';
import { externalContentContract } from './externalContentContract';
import { workspaceFieldGroupContract } from './fieldGroupContract';
import { governanceContract } from './governanceContract';
import { governanceWorkflowConfigContract } from './governanceWorkflowConfigContract';
import { glossaryContract } from './glossaryContract';
import { integrationGovernanceContract } from './integrationGovernanceContract';
import { integrationRelationContract } from './integrationRelationContract';
import { jobsContract } from './jobsContract';
import { workspaceMetricContract } from './metricContract';
import { milestoneContract } from './milestoneContract';
import { notificationPreferencesContract } from './notificationPreferencesContract';
import { projectContract } from './projectContract';
import { publicCatalogConfigContract, publicCatalogContract } from './publicCatalogContract';
import { relationChangeContract } from './relationChangeContract';
import { workspaceRelationContract } from './relationContract';
import { workspaceRelationSchemaContract } from './relationSchemaContract';
import { relationSyncContract } from './relationSyncContract';
import { relationVersionContract } from './relationVersionContract';
import { workspaceSchemaContract } from './schemaContract';
import { searchContract } from './searchContract';
import { workspaceTemplateContract } from './templateContract';
import { workspaceViewContract } from './viewContract';
import { watchContract } from './watchContract';
import { webhookContract } from './webhookContract';
import { wikiCommentContract } from './wikiCommentContract';
import { workspaceAnalyticsContract } from './analyticsContract';
import { workspaceConfigContract } from './workspaceConfigContract';
import { workspaceManagementContract } from './workspaceContract';

export type ContractSurface =
  | 'core'
  | 'application'
  | 'integration'
  | 'diagramCraft'
  | 'publicCatalog';

export type ContractSurfaceEntry = {
  readonly id: string;
  readonly contract: AnyContractRouter;
  readonly role?: 'primary' | 'projection';
  readonly projectionOf?: string;
  readonly reason?: string;
};

export type ContractSurfacePathRewrite = {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
};

type ContractSurfaceOptions = {
  readonly openApiPathRewrites?: readonly ContractSurfacePathRewrite[];
  readonly openApiPathPrefix?: string;
};

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never;

type ContractRouterFromEntries<TEntries extends readonly ContractSurfaceEntry[]> =
  UnionToIntersection<TEntries[number]['contract']>;

const mergeContractEntries = <const TEntries extends readonly ContractSurfaceEntry[]>(
  entries: TEntries
): ContractRouterFromEntries<TEntries> => {
  const merged: Record<string, AnyContractRouter> = {};

  for (const entry of entries) {
    for (const [key, contract] of Object.entries(entry.contract)) {
      if (key in merged) {
        throw new Error(`Duplicate contract router key "${key}" in contract surface manifest`);
      }
      merged[key] = contract as AnyContractRouter;
    }
  }

  return merged as ContractRouterFromEntries<TEntries>;
};

const defineSurface = <const TEntries extends readonly ContractSurfaceEntry[]>(
  entries: TEntries,
  options: ContractSurfaceOptions = {}
) => ({
  entries,
  contracts: mergeContractEntries(entries),
  ...options
});

const coreEntries = [
  { id: 'authPublicContract', contract: authPublicContract },
  { id: 'authProtectedContract', contract: authProtectedContract },
  { id: 'devContract', contract: devContract }
] as const satisfies readonly ContractSurfaceEntry[];

const applicationEntries = [
  { id: 'workspaceSchemaContract', contract: workspaceSchemaContract },
  { id: 'workspaceRelationSchemaContract', contract: workspaceRelationSchemaContract },
  { id: 'workspaceRelationContract', contract: workspaceRelationContract },
  { id: 'workspaceEntityContract', contract: workspaceEntityContract },
  { id: 'workspaceManagementContract', contract: workspaceManagementContract },
  { id: 'projectContract', contract: projectContract },
  { id: 'workspaceConfigContract', contract: workspaceConfigContract },
  { id: 'glossaryContract', contract: glossaryContract },
  { id: 'publicCatalogConfigContract', contract: publicCatalogConfigContract },
  { id: 'searchContract', contract: searchContract },
  { id: 'aiContract', contract: aiContract },
  { id: 'workspaceEnumContract', contract: workspaceEnumContract },
  { id: 'workspaceFieldGroupContract', contract: workspaceFieldGroupContract },
  { id: 'workspaceViewContract', contract: workspaceViewContract },
  { id: 'workspaceDashboardContract', contract: workspaceDashboardContract },
  { id: 'personalDashboardContract', contract: personalDashboardContract },
  { id: 'projectDashboardContract', contract: projectDashboardContract },
  { id: 'workspaceCollectionContract', contract: workspaceCollectionContract },
  { id: 'conformanceContract', contract: conformanceContract },
  { id: 'workspaceTemplateContract', contract: workspaceTemplateContract },
  { id: 'auditContract', contract: auditContract },
  { id: 'watchContract', contract: watchContract },
  { id: 'notificationPreferencesContract', contract: notificationPreferencesContract },
  { id: 'discussionContract', contract: discussionContract },
  { id: 'governanceContract', contract: governanceContract },
  { id: 'governanceWorkflowConfigContract', contract: governanceWorkflowConfigContract },
  { id: 'entityVersionContract', contract: entityVersionContract },
  { id: 'entityChangeContract', contract: entityChangeContract },
  { id: 'relationVersionContract', contract: relationVersionContract },
  { id: 'relationChangeContract', contract: relationChangeContract },
  { id: 'entityDeprecationContract', contract: entityDeprecationContract },
  { id: 'assessmentContract', contract: assessmentContract },
  { id: 'assessmentResponseContract', contract: assessmentResponseContract },
  { id: 'milestoneContract', contract: milestoneContract },
  { id: 'changeCaseContract', contract: changeCaseContract },
  { id: 'automationRuleContract', contract: automationRuleContract },
  { id: 'externalContentContract', contract: externalContentContract },
  { id: 'wikiCommentContract', contract: wikiCommentContract },
  { id: 'workspaceAnalyticsContract', contract: workspaceAnalyticsContract },
  { id: 'workspaceMetricContract', contract: workspaceMetricContract },
  { id: 'jobsContract', contract: jobsContract },
  { id: 'webhookContract', contract: webhookContract },
  { id: 'documentContract', contract: documentContract },
  { id: 'artifactContract', contract: artifactContract },
  { id: 'baselineContract', contract: baselineContract }
] as const satisfies readonly ContractSurfaceEntry[];

const integrationSchemaListProjection = {
  id: 'workspaceSchemaContract.schemas.list',
  contract: {
    schemas: {
      list: workspaceSchemaContract.schemas.list
    }
  },
  role: 'projection',
  projectionOf: 'workspaceSchemaContract.schemas.list',
  reason: 'The integration surface exposes read-only schema listing under its versioned prefix.'
} as const satisfies ContractSurfaceEntry;

const integrationPrimaryEntries = [
  { id: 'integrationRelationContract', contract: integrationRelationContract },
  { id: 'entitySyncContract', contract: entitySyncContract },
  { id: 'apiSpecificationSyncContract', contract: apiSpecificationSyncContract },
  { id: 'relationSyncContract', contract: relationSyncContract },
  { id: 'integrationGovernanceContract', contract: integrationGovernanceContract }
] as const satisfies readonly ContractSurfaceEntry[];

const integrationEntries = [
  integrationSchemaListProjection,
  ...integrationPrimaryEntries
] as const satisfies readonly ContractSurfaceEntry[];

const diagramCraftEntries = [
  { id: 'diagramCraftContract', contract: diagramCraftContract }
] as const satisfies readonly ContractSurfaceEntry[];

const publicCatalogEntries = [
  { id: 'publicCatalogContract', contract: publicCatalogContract }
] as const satisfies readonly ContractSurfaceEntry[];

export const contractSurfaceManifest = {
  surfaces: {
    core: defineSurface(coreEntries),
    application: defineSurface(applicationEntries),
    integration: defineSurface(integrationEntries, {
      openApiPathRewrites: [
        {
          from: '/{workspace}/schemas',
          to: '/integrations/v1/{workspace}/schemas',
          reason: integrationSchemaListProjection.reason
        }
      ]
    }),
    diagramCraft: defineSurface(diagramCraftEntries, {
      openApiPathPrefix: '/adapters/diagram-craft/'
    }),
    publicCatalog: defineSurface(publicCatalogEntries)
  },
  exclusions: [
    {
      id: 'mcpToolsContract',
      reason: 'MCP tools are protocol types, not HTTP oRPC contract routers.'
    },
    {
      id: 'publicCatalogFromFirstPartyClients',
      reason: 'Public catalog requests use the dedicated unauthenticated fetch client.'
    }
  ] as const
} as const;

export const allContracts = mergeContractEntries([
  ...coreEntries,
  ...applicationEntries,
  ...integrationPrimaryEntries,
  ...diagramCraftEntries
] as const);

export type ContractSurfaceManifest = typeof contractSurfaceManifest;
