import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig } from '../apiCatalogWidgetSupport';
import { ApiCatalogStatsWidget } from './ApiCatalogStatsWidget';
export default defineComponent({
  type: 'api-integration-catalog-stats',
  category: 'metrics',
  name: 'API catalog stats',
  description: 'Workspace API, governance, and integration health metrics.',
  dashboardWidget: {
    icon: TbChartBar,
    defaultW: 12,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogStatsWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
