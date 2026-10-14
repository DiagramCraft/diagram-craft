import { TbPlugConnected } from 'react-icons/tb';
import { ApiIntegrationCatalogAtRiskPanel } from '../sections/ApiIntegrationCatalogAtRiskPanel';
import panelStyles from '../sections/ApiIntegrationCatalogPanels.module.css';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import {
  isValidListConfig,
  ListConfigForm,
  useApiCatalogNavigation,
  type ListWidgetConfig
} from '../apiCatalogWidgetSupport';

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

const ApiCatalogAtRiskHeaderActions = () => {
  const { viewIntegrations } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewIntegrations}>
      All integrations
    </button>
  );
};

export const apiCatalogAtRiskSpec = defineComponent({
  type: 'api-integration-catalog-at-risk',
  category: 'data-views',
  name: 'Integrations needing attention',
  description: 'Data flows that cross a boundary or carry restricted data.',
  dashboardWidget: {
    icon: TbPlugConnected,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    component: ApiCatalogAtRiskWidget,
    headerActionsComponent: ApiCatalogAtRiskHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isValidListConfig,
    createDefaultConfig: () => ({ limit: 8 }),
    configForm: ListConfigForm
  }
});
