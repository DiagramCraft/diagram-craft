import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { CountByFieldConfigForm } from './CountByFieldConfigForm';
import { CountByFieldWidget } from './CountByField';
import { countByFieldWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'CountByField',
  category: 'metrics',
  name: 'Count by field',
  description: 'Entity count with a stacked bar per value of a field.',
  icon: TbChartBar,
  component: CountByFieldWidget,
  configForm: CountByFieldConfigForm,
  configSchema: countByFieldWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 8,
    surfaces: ['workspace']
  }
});
