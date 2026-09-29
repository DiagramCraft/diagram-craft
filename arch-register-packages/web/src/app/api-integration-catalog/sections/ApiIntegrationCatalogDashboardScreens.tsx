import { useParams } from '@tanstack/react-router';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { useResolvedApiIntegrationCatalogConfig } from '../useResolvedApiIntegrationCatalogConfig';
import { apiIntegrationCatalogAppDefinition } from '../apiIntegrationCatalogShell';
import {
  IC_OVERVIEW_ID,
  IC_IMPACT_ID,
  type ApiIntegrationCatalogRailItemId
} from '../apiIntegrationCatalogSections';

const NOT_ENABLED_MESSAGE = (
  <>
    API & Integration Catalog is not enabled. Configure the API specification capability in
    workspace settings.
  </>
);

/**
 * `AppRailSection.dashboard.appKey` (declared once in `apiIntegrationCatalogShell.tsx`) is the
 * source of truth these two screens render, rather than a literal repeated here (#3469).
 */
const sectionDashboardAppKey = (id: ApiIntegrationCatalogRailItemId): string => {
  const appKey = apiIntegrationCatalogAppDefinition.sections.find(section => section.id === id)
    ?.dashboard?.appKey;
  if (!appKey) throw new Error(`API & Integration Catalog section "${id}" has no dashboard.appKey`);
  return appKey;
};

export const ApiIntegrationCatalogOverviewDashboard = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const { apiConfig, isLoading } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey(IC_OVERVIEW_ID)}
      isLoading={isLoading}
      isEnabled={apiConfig !== null}
      loadingMessage="Loading API & Integration Catalog…"
      notEnabledMessage={NOT_ENABLED_MESSAGE}
    />
  );
};

export const ApiIntegrationCatalogImpactDashboard = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const { apiConfig, isLoading } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey(IC_IMPACT_ID)}
      isLoading={isLoading}
      isEnabled={apiConfig !== null}
      loadingMessage="Loading API & Integration Catalog…"
      notEnabledMessage={NOT_ENABLED_MESSAGE}
    />
  );
};
