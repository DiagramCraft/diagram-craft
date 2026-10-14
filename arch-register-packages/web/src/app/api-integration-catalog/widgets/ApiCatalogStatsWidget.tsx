import { TbChartBar } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiIntegrationCatalogStatTiles } from '../sections/ApiIntegrationCatalogStatTiles';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig, type BaseWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogStatsWidget = ({ config: _config }: { config: BaseWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogStatTiles workspaceId={workspaceSlug} />;
};

export const apiCatalogStatsSpec = defineComponent({
  type: 'api-integration-catalog-stats',
  category: 'metrics',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbChartBar,
    label: 'API catalog stats',
    description: 'Workspace API, governance, and integration health metrics.',
    defaultW: 12,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogStatsWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
