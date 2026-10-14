import { TbAlertTriangle } from 'react-icons/tb';
import { schemaGuard } from '../../../sections/markdown/mdx-components/configSchema';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { listWidgetConfigSchema, ListConfigForm } from '../apiCatalogWidgetSupport';
import {
  ApiCatalogNeedsAttentionHeaderActions,
  ApiCatalogNeedsAttentionWidget
} from './ApiCatalogNeedsAttentionWidget';
export default defineComponent({
  type: 'api-integration-catalog-needs-attention',
  category: 'data-views',
  name: 'API needs attention',
  description: 'Open API change and deprecation cases awaiting a decision.',
  icon: TbAlertTriangle,
  component: ApiCatalogNeedsAttentionWidget,
  createDefaultProps: () => ({ config: { limit: 8 } }),
  configForm: ListConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    headerActionsComponent: ApiCatalogNeedsAttentionHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: schemaGuard(listWidgetConfigSchema)
  }
});
