/**
 * API & Integration Catalog's rail-item ids, routes, and labels — split out from
 * `apiIntegrationCatalogShell.tsx` so both it and `sections/ApiIntegrationCatalogSidebar.tsx` can
 * depend on this leaf module without an import cycle (the sidebar is rendered by the shell's
 * `primarySidebar` factories, and also needs the ids/routes to navigate between sections). Mirrors
 * `../risk-compliance/riskComplianceSections.ts`.
 *
 * Unlike Data Stewardship, there is a separate Overview section — "Overview" is `sections[0]` and
 * the app's landing screen, per #3150.
 */
export const IC_OVERVIEW_ID = 'api-integration-catalog-overview' as const;
export const IC_APIS_ID = 'api-integration-catalog-apis' as const;
export const IC_INTEGRATIONS_ID = 'api-integration-catalog-integrations' as const;
export const IC_SYNC_ID = 'api-integration-catalog-sync' as const;
export const IC_IMPACT_ID = 'api-integration-catalog-impact' as const;

export type ApiIntegrationCatalogRailItemId =
  | typeof IC_OVERVIEW_ID
  | typeof IC_APIS_ID
  | typeof IC_INTEGRATIONS_ID
  | typeof IC_SYNC_ID
  | typeof IC_IMPACT_ID;

export const IC_RAIL_PATHS: Record<ApiIntegrationCatalogRailItemId, string> = {
  [IC_OVERVIEW_ID]: '/$workspaceSlug/api-integration-catalog',
  [IC_APIS_ID]: '/$workspaceSlug/api-integration-catalog/apis',
  [IC_INTEGRATIONS_ID]: '/$workspaceSlug/api-integration-catalog/integrations',
  [IC_SYNC_ID]: '/$workspaceSlug/api-integration-catalog/sync',
  [IC_IMPACT_ID]: '/$workspaceSlug/api-integration-catalog/impact'
};

export const IC_SECTION_LABELS: Record<ApiIntegrationCatalogRailItemId, string> = {
  [IC_OVERVIEW_ID]: 'Overview',
  [IC_APIS_ID]: 'APIs',
  [IC_INTEGRATIONS_ID]: 'Integrations',
  [IC_SYNC_ID]: 'Sync',
  [IC_IMPACT_ID]: 'Impact'
};

export const IC_SECTIONS: { id: ApiIntegrationCatalogRailItemId; label: string }[] = [
  IC_OVERVIEW_ID,
  IC_APIS_ID,
  IC_INTEGRATIONS_ID,
  IC_SYNC_ID,
  IC_IMPACT_ID
].map(id => ({ id, label: IC_SECTION_LABELS[id] }));
