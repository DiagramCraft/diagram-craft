import { TbApi } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { listWidgetConfigSchema, ListConfigForm } from '../apiCatalogWidgetSupport';
import {
  ApiCatalogMostConsumedHeaderActions,
  ApiCatalogMostConsumedWidget
} from './ApiCatalogMostConsumedWidget';
export default defineComponent({
  type: 'api-integration-catalog-most-consumed',
  category: 'data-views',
  name: 'Most consumed APIs',
  description: 'APIs with the most registered consumers.',
  icon: TbApi,
  component: ApiCatalogMostConsumedWidget,
  configForm: ListConfigForm,
  // This list is shorter than the other lists, which share the schema's starting limit.
  defaultConfig: () => ({ limit: 6 }),
  configSchema: listWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    headerActionsComponent: ApiCatalogMostConsumedHeaderActions,
    frame: { padded: false, showIcon: false }
  }
});
