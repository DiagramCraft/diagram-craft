import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RatioBarListConfigForm,
  RatioBarListWidget,
  ratioBarListWidgetConfigSchema
} from './RatioBarListWidget';

export default defineComponent({
  type: 'RatioBarList',
  category: 'metrics',
  name: 'Ratio bars',
  description: 'One coverage bar per value of a field, filled by the share matching a field value.',
  icon: TbChartBar,
  component: RatioBarListWidget,
  configForm: RatioBarListConfigForm,
  configSchema: ratioBarListWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
