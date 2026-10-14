import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { COUNT_BY_FIELD_TYPE, _countByFieldSpecData } from './CountByFieldWidget';

const { icon, component, configForm, createDefaultProps, ...dashboardWidget } = _countByFieldSpecData;
export default defineComponent({
  type: COUNT_BY_FIELD_TYPE,
  category: 'metrics',
  name: 'Count by field',
  description: 'Entity count with a stacked bar per value of a field.',
  component: component!,
  configForm,
  createDefaultProps,
  icon,
  dashboardWidget
});
