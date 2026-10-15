import { ApiIntegrationCatalogMostConsumedPanel } from '../sections/ApiIntegrationCatalogMostConsumedPanel';
import panelStyles from '../sections/ApiIntegrationCatalogPanels.module.css';

import { useApiCatalogNavigation, type ListWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogMostConsumedWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, openApi, viewCatalog } = useApiCatalogNavigation();

  return (
    <ApiIntegrationCatalogMostConsumedPanel
      workspaceId={workspaceSlug}
      apiSchemaId={null}
      onOpenApi={openApi}
      onViewCatalog={viewCatalog}
      limit={config.limit}
      embedded
    />
  );
};

export const ApiCatalogMostConsumedHeaderActions = () => {
  const { viewCatalog } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewCatalog}>
      Catalog
    </button>
  );
};
