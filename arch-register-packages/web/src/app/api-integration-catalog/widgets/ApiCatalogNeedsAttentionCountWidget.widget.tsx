import { TbAlertTriangle } from 'react-icons/tb';
import { defineWidget } from '../../../widgets/shared/defineWidget';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogNeedsAttentionCountWidget } from './ApiCatalogNeedsAttentionCountWidget';
export default defineWidget({
  type: 'api-integration-catalog-needs-attention-count',
  category: 'metrics',
  name: 'Needs attention (count)',
  description: 'Number of open API change and deprecation cases.',
  icon: TbAlertTriangle,
  component: ApiCatalogNeedsAttentionCountWidget,
  configSchema: baseWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
