import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../../widgets/shared/defineWidget';
import { baseWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogPairGapsWidget } from './ApiCatalogPairGapsWidget';
export default defineWidget({
  type: 'api-integration-catalog-pair-gaps',
  category: 'data-views',
  name: 'Provider/consumer gaps',
  description: 'API provider/consumer pairs without a matching Data Flow.',
  icon: TbChartBar,
  component: ApiCatalogPairGapsWidget,
  configSchema: baseWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
