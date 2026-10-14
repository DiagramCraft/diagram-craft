import { TbChartBar } from 'react-icons/tb';
import { schemaGuard } from '../../../sections/markdown/mdx-components/configSchema';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogPairGapsWidget } from './ApiCatalogPairGapsWidget';
export default defineComponent({
  type: 'api-integration-catalog-pair-gaps',
  category: 'data-views',
  name: 'Provider/consumer gaps',
  description: 'API provider/consumer pairs without a matching Data Flow.',
  icon: TbChartBar,
  component: ApiCatalogPairGapsWidget,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: schemaGuard(baseWidgetConfigSchema)
  }
});
