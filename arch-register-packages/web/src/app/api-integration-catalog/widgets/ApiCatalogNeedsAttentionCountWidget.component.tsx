import { TbAlertTriangle } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig } from '../apiCatalogWidgetSupport';
import { ApiCatalogNeedsAttentionCountWidget } from './ApiCatalogNeedsAttentionCountWidget';
export default defineComponent({
  type: 'api-integration-catalog-needs-attention-count',
  category: 'metrics',
  name: 'Needs attention (count)',
  description: 'Number of open API change and deprecation cases.',
  dashboardWidget: {
    icon: TbAlertTriangle,
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogNeedsAttentionCountWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
