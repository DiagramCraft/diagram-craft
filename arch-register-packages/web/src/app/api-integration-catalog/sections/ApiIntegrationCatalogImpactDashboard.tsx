import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import placeholderStyles from './ApiIntegrationCatalogPlaceholderScreen.module.css';

export const ApiIntegrationCatalogImpactDashboard = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={placeholderStyles.empty}>Loading API & Integration Catalog…</div>;
  }
  if (!resolveApiIntegrationCatalogConfig(configurations.data)) {
    return (
      <div className={placeholderStyles.empty}>
        API & Integration Catalog is not enabled. Configure the API specification capability in
        workspace settings.
      </div>
    );
  }

  return <AppDashboardScreen appKey="api-integration-catalog-impact" />;
};
