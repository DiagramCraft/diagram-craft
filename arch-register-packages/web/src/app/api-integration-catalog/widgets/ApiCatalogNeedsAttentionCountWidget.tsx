import { TbAlertTriangle } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiIntegrationCatalogSingleStatTile } from '../sections/ApiIntegrationCatalogSingleStatTile';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig, type BaseWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogNeedsAttentionCountWidget = ({
  config: _config
}: {
  config: BaseWidgetConfig;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogSingleStatTile workspaceId={workspaceSlug} kind="needs-attention" />;
};

export const apiCatalogNeedsAttentionCountSpec = defineComponent({
  type: 'api-integration-catalog-needs-attention-count',
  category: 'metrics',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'Needs attention (count)',
    description: 'Number of open API change and deprecation cases.',
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogNeedsAttentionCountWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
