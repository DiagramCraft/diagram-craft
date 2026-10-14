import { TbPlugConnected } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { listWidgetConfigSchema, ListConfigForm } from '../apiCatalogWidgetSupport';
import { ApiCatalogAtRiskHeaderActions, ApiCatalogAtRiskWidget } from './ApiCatalogAtRiskWidget';
export default defineComponent({
  type: 'api-integration-catalog-at-risk',
  category: 'data-views',
  name: 'Integrations needing attention',
  description: 'Data flows that cross a boundary or carry restricted data.',
  icon: TbPlugConnected,
  component: ApiCatalogAtRiskWidget,
  configForm: ListConfigForm,
  configSchema: listWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    headerActionsComponent: ApiCatalogAtRiskHeaderActions,
    frame: { padded: false, showIcon: false }
  }
});
