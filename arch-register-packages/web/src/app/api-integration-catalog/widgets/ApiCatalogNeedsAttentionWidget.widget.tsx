import { TbAlertTriangle } from 'react-icons/tb';
import { defineWidget } from '../../../widgets/shared/defineWidget';
import { listWidgetConfigSchema, ListConfigForm } from '../apiCatalogWidgetSupport';
import {
  ApiCatalogNeedsAttentionHeaderActions,
  ApiCatalogNeedsAttentionWidget
} from './ApiCatalogNeedsAttentionWidget';
export default defineWidget({
  type: 'api-integration-catalog-needs-attention',
  category: 'data-views',
  name: 'API needs attention',
  description: 'Open API change and deprecation cases awaiting a decision.',
  icon: TbAlertTriangle,
  component: ApiCatalogNeedsAttentionWidget,
  configForm: ListConfigForm,
  configSchema: listWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    headerActionsComponent: ApiCatalogNeedsAttentionHeaderActions,
    frame: { padded: false, showIcon: false }
  }
});
