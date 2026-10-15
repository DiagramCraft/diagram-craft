import { ApiIntegrationCatalogAtRiskPanel } from '../sections/ApiIntegrationCatalogAtRiskPanel';
import panelStyles from '../sections/ApiIntegrationCatalogPanels.module.css';

import { useApiCatalogNavigation, type ListWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogAtRiskWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, viewIntegrations } = useApiCatalogNavigation();

  return (
    <ApiIntegrationCatalogAtRiskPanel
      workspaceId={workspaceSlug}
      onViewIntegrations={viewIntegrations}
      limit={config.limit}
      embedded
    />
  );
};

export const ApiCatalogAtRiskHeaderActions = () => {
  const { viewIntegrations } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewIntegrations}>
      All integrations
    </button>
  );
};
