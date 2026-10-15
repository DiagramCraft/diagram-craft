import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../../sections/markdown/mdx-components/defineWidget';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogStatsWidget } from './ApiCatalogStatsWidget';
export default defineWidget({
  type: 'api-integration-catalog-stats',
  category: 'metrics',
  name: 'API catalog stats',
  description: 'Workspace API, governance, and integration health metrics.',
  icon: TbChartBar,
  component: ApiCatalogStatsWidget,
  configSchema: baseWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
