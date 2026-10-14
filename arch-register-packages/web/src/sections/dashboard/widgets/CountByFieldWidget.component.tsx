import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CountByFieldConfigForm,
  CountByFieldWidget,
  countByFieldWidgetConfigSchema
} from './CountByFieldWidget';

export default defineComponent({
  type: 'CountByField',
  category: 'metrics',
  name: 'Count by field',
  description: 'Entity count with a stacked bar per value of a field.',
  icon: TbChartBar,
  component: CountByFieldWidget,
  configForm: CountByFieldConfigForm,
  configSchema: countByFieldWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 8,
    surfaces: ['workspace']
  }
});
