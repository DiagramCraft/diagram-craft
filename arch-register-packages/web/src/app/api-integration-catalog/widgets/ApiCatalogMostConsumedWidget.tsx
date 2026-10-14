import { TbApi } from 'react-icons/tb';
import { ApiIntegrationCatalogMostConsumedPanel } from '../sections/ApiIntegrationCatalogMostConsumedPanel';
import panelStyles from '../sections/ApiIntegrationCatalogPanels.module.css';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import {
  isValidListConfig,
  ListConfigForm,
  useApiCatalogNavigation,
  type ListWidgetConfig
} from '../apiCatalogWidgetSupport';

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

const ApiCatalogMostConsumedHeaderActions = () => {
  const { viewCatalog } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewCatalog}>
      Catalog
    </button>
  );
};

export const apiCatalogMostConsumedSpec = defineComponent({
  type: 'api-integration-catalog-most-consumed',
  category: 'data-views',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbApi,
    label: 'Most consumed APIs',
    description: 'APIs with the most registered consumers.',
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    component: ApiCatalogMostConsumedWidget,
    headerActionsComponent: ApiCatalogMostConsumedHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isValidListConfig,
    createDefaultConfig: () => ({ limit: 6 }),
    configForm: ListConfigForm
  }
});
