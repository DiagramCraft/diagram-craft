import { TbAlertTriangle } from 'react-icons/tb';
import { schemaGuard } from '../../../sections/markdown/mdx-components/configSchema';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogNeedsAttentionCountWidget } from './ApiCatalogNeedsAttentionCountWidget';
export default defineComponent({
  type: 'api-integration-catalog-needs-attention-count',
  category: 'metrics',
  name: 'Needs attention (count)',
  description: 'Number of open API change and deprecation cases.',
  icon: TbAlertTriangle,
  component: ApiCatalogNeedsAttentionCountWidget,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: schemaGuard(baseWidgetConfigSchema)
  }
});
