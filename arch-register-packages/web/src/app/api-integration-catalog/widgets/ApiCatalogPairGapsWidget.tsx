import { TbChartBar } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiIntegrationCatalogSingleStatTile } from '../sections/ApiIntegrationCatalogSingleStatTile';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig, type BaseWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogPairGapsWidget = ({ config: _config }: { config: BaseWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogSingleStatTile workspaceId={workspaceSlug} kind="pair-gaps" />;
};

export const apiCatalogPairGapsSpec = defineComponent({
  type: 'api-integration-catalog-pair-gaps',
  category: 'data-views',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbChartBar,
    label: 'Provider/consumer gaps',
    description: 'API provider/consumer pairs without a matching Data Flow.',
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogPairGapsWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
