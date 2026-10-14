import { TbApi } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidListConfig, ListConfigForm } from '../apiCatalogWidgetSupport';
import {
  ApiCatalogMostConsumedHeaderActions,
  ApiCatalogMostConsumedWidget
} from './ApiCatalogMostConsumedWidget';
export default defineComponent({
  type: 'api-integration-catalog-most-consumed',
  category: 'data-views',
  name: 'Most consumed APIs',
  description: 'APIs with the most registered consumers.',
  dashboardWidget: {
    icon: TbApi,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    component: ApiCatalogMostConsumedWidget,
    headerActionsComponent: ApiCatalogMostConsumedHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isValidListConfig,
    createDefaultConfig: () => ({ limit: 6 }),
    configForm: ListConfigForm
  }
});
