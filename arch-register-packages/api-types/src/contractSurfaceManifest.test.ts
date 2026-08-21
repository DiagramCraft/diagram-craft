import { describe, expect, it } from 'vitest';
import {
  allContracts,
  contractSurfaceManifest,
  type ContractSurfaceEntry
} from './contractSurfaceManifest';

const expectedPrimaryContractIds = [
  'authPublicContract',
  'authProtectedContract',
  'devContract',
  'workspaceSchemaContract',
  'workspaceRelationSchemaContract',
  'workspaceRelationContract',
  'workspaceEntityContract',
  'workspaceManagementContract',
  'projectContract',
  'workspaceConfigContract',
  'publicCatalogConfigContract',
  'searchContract',
  'aiContract',
  'workspaceEnumContract',
  'workspaceFieldGroupContract',
  'workspaceViewContract',
  'workspaceDashboardContract',
  'personalDashboardContract',
  'projectDashboardContract',
  'workspaceCollectionContract',
  'conformanceContract',
  'workspaceTemplateContract',
  'auditContract',
  'watchContract',
  'notificationPreferencesContract',
  'discussionContract',
  'governanceContract',
  'governanceWorkflowConfigContract',
  'entityVersionContract',
  'entityChangeContract',
  'relationVersionContract',
  'relationChangeContract',
  'entityDeprecationContract',
  'assessmentContract',
  'assessmentResponseContract',
  'milestoneContract',
  'changeCaseContract',
  'automationRuleContract',
  'externalContentContract',
  'glossaryContract',
  'wikiCommentContract',
  'workspaceAnalyticsContract',
  'workspaceMetricContract',
  'jobsContract',
  'webhookContract',
  'documentContract',
  'artifactContract',
  'baselineContract',
  'integrationRelationContract',
  'entitySyncContract',
  'apiSpecificationSyncContract',
  'relationSyncContract',
  'integrationGovernanceContract',
  'diagramCraftContract',
  'publicCatalogContract'
].sort();

const surfaces = Object.values(contractSurfaceManifest.surfaces) as readonly {
  entries: readonly ContractSurfaceEntry[];
}[];

const surfaceEntries = surfaces.flatMap(surface => surface.entries);

describe('contract surface manifest', () => {
  it('classifies every REST contract exactly once', () => {
    const primaryIds = surfaceEntries
      .filter(entry => (entry.role ?? 'primary') === 'primary')
      .map(entry => entry.id)
      .sort();

    expect(primaryIds).toEqual(expectedPrimaryContractIds);
    expect(new Set(primaryIds).size).toBe(primaryIds.length);
    expect(Object.keys(allContracts).length).toBeGreaterThan(0);
  });

  it('documents the integration schema projection and path rewrite', () => {
    const projection = (
      contractSurfaceManifest.surfaces.integration.entries as readonly ContractSurfaceEntry[]
    ).find(entry => entry.role === 'projection');

    expect(projection).toMatchObject({
      id: 'workspaceSchemaContract.schemas.list',
      projectionOf: 'workspaceSchemaContract.schemas.list',
      reason: expect.any(String)
    });
    expect(contractSurfaceManifest.surfaces.integration.openApiPathRewrites).toEqual([
      {
        from: '/{workspace}/schemas',
        to: '/integrations/v1/{workspace}/schemas',
        reason: expect.any(String)
      }
    ]);
  });

  it('does not silently merge duplicate top-level contract routers', () => {
    for (const surface of surfaces) {
      const keys = surface.entries.flatMap(entry => Object.keys(entry.contract));
      expect(new Set(keys).size, surface.entries.map(entry => entry.id).join(', ')).toBe(
        keys.length
      );
    }
  });

  it('records non-REST and public-client exclusions', () => {
    expect(contractSurfaceManifest.exclusions).toEqual([
      {
        id: 'mcpToolsContract',
        reason: 'MCP tools are protocol types, not HTTP oRPC contract routers.'
      },
      {
        id: 'publicCatalogFromFirstPartyClients',
        reason: 'Public catalog requests use the dedicated unauthenticated fetch client.'
      }
    ]);
  });
});
