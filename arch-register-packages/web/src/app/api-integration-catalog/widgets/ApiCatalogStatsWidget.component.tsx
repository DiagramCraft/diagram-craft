import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogStatsWidget } from './ApiCatalogStatsWidget';
export default defineComponent({
  type: 'api-integration-catalog-stats',
  category: 'metrics',
  name: 'API catalog stats',
  description: 'Workspace API, governance, and integration health metrics.',
  icon: TbChartBar,
  component: ApiCatalogStatsWidget,
  createDefaultProps: () => ({ config: {} }),
  configSchema: baseWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
