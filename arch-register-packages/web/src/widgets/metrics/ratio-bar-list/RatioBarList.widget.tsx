import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  RatioBarListConfigForm,
  RatioBarListWidget,
  ratioBarListWidgetConfigSchema
} from './RatioBarList';

export default defineWidget({
  type: 'RatioBarList',
  category: 'metrics',
  name: 'Ratio bars',
  description: 'One coverage bar per value of a field, filled by the share matching a field value.',
  icon: TbChartBar,
  component: RatioBarListWidget,
  configForm: RatioBarListConfigForm,
  configSchema: ratioBarListWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
