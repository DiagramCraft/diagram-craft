import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidBaseConfig } from '../apiCatalogWidgetSupport';
import { ApiCatalogPairGapsWidget } from './ApiCatalogPairGapsWidget';
export default defineComponent({
  type: 'api-integration-catalog-pair-gaps',
  category: 'data-views',
  name: 'Provider/consumer gaps',
  description: 'API provider/consumer pairs without a matching Data Flow.',
  dashboardWidget: {
    icon: TbChartBar,
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ApiCatalogPairGapsWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isValidBaseConfig,
    createDefaultConfig: () => ({})
  }
});
