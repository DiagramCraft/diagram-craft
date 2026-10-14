import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  COUNT_BY_FIELD_TYPE,
  CountByFieldConfigForm,
  CountByFieldWidget,
  CountByFieldWidgetConfig,
  isCountByFieldConfigComplete
} from './CountByFieldWidget';

export default defineComponent({
  type: COUNT_BY_FIELD_TYPE,
  category: 'metrics',
  name: 'Count by field',
  description: 'Entity count with a stacked bar per value of a field.',
  icon: TbChartBar,
  component: CountByFieldWidget,
  createDefaultProps: () => ({ config: { schemaName: '', fieldId: '' } }),
  configForm: CountByFieldConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 8,
    surfaces: ['workspace'],
    isValidConfig: (config): config is CountByFieldWidgetConfig =>
      typeof config.schemaName === 'string' &&
      typeof config.fieldId === 'string' &&
      isCountByFieldConfigComplete(config as CountByFieldWidgetConfig)
  }
});
