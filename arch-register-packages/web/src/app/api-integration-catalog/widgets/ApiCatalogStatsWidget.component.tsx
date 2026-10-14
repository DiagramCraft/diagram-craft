import { TbChartBar } from 'react-icons/tb';
import { schemaGuard } from '../../../sections/markdown/mdx-components/configSchema';
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
  dashboardWidget: {
    defaultW: 12,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: schemaGuard(baseWidgetConfigSchema)
  }
});
